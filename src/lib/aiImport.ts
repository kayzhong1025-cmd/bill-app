import { parseCsvText, rowsToRecords } from "./csv";
import Papa from "papaparse";
import type { BillRecord } from "../types/bill";
import { type ImportRules, buildCleaningPrompt } from "./importRules";
import {
  validateAIResponse,
  validateAICsvOutput,
  validateParsedCsv,
  isValidBillRecord,
  sanitizeDataSummary,
  sanitizeAuditQuestions,
} from "./aiImportValidation";
import { reportSummaryParseError } from "./aiImportErrorReporter";

const ALIYUN_MODEL = "qwen3.5-flash";
const ALIYUN_API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

export interface AuditQuestion {
  id: string;
  question: string;
  context?: string;
}

export interface AuditResult {
  hasQuestions: boolean;
  questions: AuditQuestion[];
}

const AUDIT_PROMPT = `你是个人财务审计师。请逐条检查以下全部原始账单数据，不要遗漏任何一条。

如有需要用户确认的事项，请只输出以下 JSON 格式（不要输出其他文字、不要输出 CSV）：
{"type":"questions","questions":[{"id":"q1","question":"问题描述","context":"相关上下文（如日期、金额、交易对方）"}]}

重点关注以下需确认事项（请针对具体记录提问，让用户明确回答）：
1. 大额转账/支出（特别是大于 1000 元的“转账”）：请具体问「某笔 X 元转账（日期、交易对方）具体用途是什么？应归入哪一类？是否属于不计收支？」
2. 无法对冲的大额款项：如果发现大额支出，但没有对应的收入对冲，或者大额收入没有对应支出，询问其性质。
3. 分类歧义：无法确定应归入哪一类，请列出选项让用户选择。
4. 疑似重复记录：需用户确认是否删除。

若没有需要确认的，请只输出：{"type":"ok"}`;

export interface TopItem {
  amount: number;
  description: string;
  date?: string;
  type?: "income" | "expense" | "transfer";
}

export interface CategoryItem {
  category: string;
  count: number;
  amount: number;
}

export interface DataSummary {
  estimatedCount: number;
  dateRange: string;
  sources: string[];
  noiseCount: number;
  qualityRating: "可用" | "部分可用" | "建议不导入";
  summaryText: string;
  /** 支出金额 Top 10（按金额降序） */
  top10Expense?: TopItem[];
  /** 收入金额 Top 10 */
  top10Income?: TopItem[];
  /** 分类分布（分类名、笔数、金额） */
  categoryBreakdown?: CategoryItem[];
  /** 预估总支出 */
  totalExpense?: number;
  /** 预估总收入 */
  totalIncome?: number;
  /** 记录建议：应如何记录、注意事项 */
  recordGuidance?: string;
}

const SUMMARY_PROMPT = `你是个人财务审计师。请对以下原始账单数据进行详细概览分析。

请只输出以下 JSON 格式（不要输出其他文字）：
{
  "estimatedCount": 150,
  "dateRange": "2024-01-01 至 2024-01-31",
  "sources": ["微信", "支付宝"],
  "noiseCount": 5,
  "qualityRating": "可用",
  "summaryText": "数据整体完整，包含微信和支付宝账单，发现少量退款记录。",
  "totalExpense": 15000.00,
  "totalIncome": 8000.00,
  "top10Expense": [
    {"amount": 5000, "description": "房租", "date": "2024-01-05", "type": "expense"},
    {"amount": 1200, "description": "餐饮", "date": "2024-01-10", "type": "expense"}
  ],
  "top10Income": [
    {"amount": 5000, "description": "工资", "date": "2024-01-15", "type": "income"}
  ],
  "categoryBreakdown": [
    {"category": "住房物业", "count": 1, "amount": 5000},
    {"category": "餐饮美食", "count": 12, "amount": 1200}
  ],
  "recordGuidance": "建议：1. 房租记为住房物业；2. 群收款等 AA 回款可对冲对应消费；3. 退款记录已剔除。"
}

其中 qualityRating 只能是 "可用"、"部分可用" 或 "建议不导入" 之一。
noiseCount 指疑似退款、交易关闭等非真实消费记录的估算数量。
top10Expense/top10Income 各最多 10 条，按金额降序。
categoryBreakdown 列出主要分类。
recordGuidance 给出 2-4 条具体记录建议，帮助用户判断数据是否准确。`;

/** 从原始文本中启发式提取基础概览（AI 失败时静默兜底，不向用户暴露异常） */
export function buildFallbackSummary(rawText: string, _userAnswers?: Record<string, string>, _globalInstruction?: string): DataSummary {
  const lines = rawText.split("\n").filter((l) => l.trim());
  let estimatedCount = 0;
  let totalExpense = 0;
  let totalIncome = 0;
  const sources: string[] = [];
  if (/微信|wechat/i.test(rawText)) sources.push("微信");
  if (/支付宝|alipay/i.test(rawText)) sources.push("支付宝");

  for (const line of lines) {
    const m1 = line.match(/共\s*(\d+)\s*笔/);
    if (m1) estimatedCount = Math.max(estimatedCount, parseInt(m1[1], 10));
    // 支出：138笔 11864.58元 或 支出：138笔11864.58元
    const m2 = line.match(/支出[：:]\s*(\d+)\s*笔\s*([\d.,]+)\s*元?/);
    if (m2) totalExpense = parseFloat(m2[2].replace(/,/g, "")) || totalExpense;
    const m3 = line.match(/收入[：:]\s*(\d+)\s*笔\s*([\d.,]+)\s*元?/);
    if (m3) totalIncome = parseFloat(m3[2].replace(/,/g, "")) || totalIncome;
  }
  if (estimatedCount === 0) {
    const dataLines = lines.filter((l) => /^\d{4}[-/年]/.test(l) || /,.*,.*\d+\.?\d*/.test(l));
    estimatedCount = Math.max(dataLines.length, lines.length >> 1);
  }

  const dateMatch = rawText.match(/(\d{4})[-/年](\d{1,2})[-/月]/);
  const dateRange = dateMatch
    ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-01 至 ${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-月末`
    : "未知";

  const sourceStr = sources.length ? sources.join("、") : "未知";
  
  // 尝试使用精确统计
  const exactStats = extractExactStats(rawText);
  if (exactStats.estimatedCount > 0) {
    estimatedCount = exactStats.estimatedCount;
    totalExpense = exactStats.totalExpense;
    totalIncome = exactStats.totalIncome;
  }

  // 如果没有识别到任何数据，尝试简单的行数估算
  if (estimatedCount === 0) {
    const dataLines = lines.filter((l) => /^\d{4}[-/年]/.test(l) || /,.*,.*\d+\.?\d*/.test(l));
    estimatedCount = Math.max(dataLines.length, lines.length >> 1);
  }

  const summaryText =
    totalExpense > 0 || totalIncome > 0
      ? `数据整体完整，包含${sourceStr}账单。支出约 ¥${totalExpense.toLocaleString("zh-CN")}，收入约 ¥${totalIncome.toLocaleString("zh-CN")}。`
      : `数据整体完整，包含${sourceStr}账单，共约 ${estimatedCount} 条记录。`;

  return {
    estimatedCount: Math.min(estimatedCount, 10000),
    dateRange,
    sources: sources.length ? sources : ["未知"],
    noiseCount: 0,
    qualityRating: "可用",
    summaryText,
    totalExpense: totalExpense > 0 ? totalExpense : undefined,
    totalIncome: totalIncome > 0 ? totalIncome : undefined,
    top10Expense: exactStats.top10Expense.length > 0 ? exactStats.top10Expense : undefined,
    top10Income: exactStats.top10Income.length > 0 ? exactStats.top10Income : undefined,
    categoryBreakdown: exactStats.categoryBreakdown.length > 0 ? exactStats.categoryBreakdown : undefined,
  };
}

/** 尝试修复常见 JSON 问题后解析 */
function tryParseJson(text: string): Record<string, unknown> | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  let raw = jsonMatch[0];
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // 尝试修复：尾随逗号、单引号、未转义换行等
    const fixed = raw
      .replace(/,(\s*[}\]])/g, "$1")
      .replace(/'/g, '"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "");
    try {
      return JSON.parse(fixed) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

/** 提取精确的统计数据，避免 AI 幻觉 */
function extractExactStats(rawText: string) {
  let totalExpense = 0;
  let totalIncome = 0;
  let estimatedCount = 0;
  
  let top10Expense: TopItem[] = [];
  let top10Income: TopItem[] = [];
  let categoryBreakdown: CategoryItem[] = [];
  
  const lines = rawText.split("\n");
  
  let headerFound = false;
  // 1. 尝试从微信/支付宝的头部提取（如果存在）
  for (const line of lines) {
    const m1 = line.match(/共\s*(\d+)\s*笔/);
    if (m1) { estimatedCount += parseInt(m1[1], 10); headerFound = true; }
    
    const m2 = line.match(/(?:支出|已支出)[：:]\s*\d+\s*笔\s*[,，]?\s*([\d.,]+)\s*元?/);
    if (m2) { totalExpense += parseFloat(m2[1].replace(/,/g, "")); headerFound = true; }
    
    const m3 = line.match(/(?:收入|已收入)[：:]\s*\d+\s*笔\s*[,，]?\s*([\d.,]+)\s*元?/);
    if (m3) { totalIncome += parseFloat(m3[1].replace(/,/g, "")); headerFound = true; }
  }

  // 2. 始终尝试作为 CSV 解析以获取分类和 Top 10 明细
  let csvValidRows = 0;
  let csvTotalExpense = 0;
  let csvTotalIncome = 0;
  const expenses: TopItem[] = [];
  const incomes: TopItem[] = [];
  const catMap = new Map<string, { count: number; amount: number }>();

  const headerIndex = lines.findIndex(l => l.includes('金额') && (l.includes('收支') || l.includes('收/支') || l.includes('交易类型')));
  if (headerIndex !== -1) {
    const csvText = lines.slice(headerIndex).join('\n');
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    if (parsed.data && parsed.data.length > 0) {
      for (const row of parsed.data as any[]) {
        const typeStr = row['收支'] || row['收/支'] || row['交易类型'] || '';
        const amountStr = row['金额_净值'] || row['金额(元)'] || row['金额'] || '0';
        const amount = Math.abs(parseFloat(amountStr.replace(/¥|,/g, '')));
        const desc = (row['商品说明'] || row['商品'] || row['交易对方'] || row['备注'] || '未知').trim();
        const date = row['交易时间'] || row['时间'] || row['日期'] || '';
        const category = (row['精细分类'] || row['审计分类'] || row['分类'] || row['交易分类'] || '未分类').trim();
        
        if (isNaN(amount) || amount === 0) continue;
        
        csvValidRows++;
        let isExp = false;
        let isInc = false;
        if (typeStr.includes('支出')) {
          csvTotalExpense += amount;
          isExp = true;
          expenses.push({ amount, description: desc, date, type: 'expense' });
        } else if (typeStr.includes('收入')) {
          if (category === "年度总收入" || category === "兼职收入" || category === "其他收入" || category.includes("收入")) {
            csvTotalIncome += amount;
            isInc = true;
            incomes.push({ amount, description: desc, date, type: 'income' });
          } else {
            // Treat other incomes as refunds (negative expense)
            csvTotalExpense -= amount;
            isExp = true;
            // We don't push refunds to top expenses, but they reduce the total
          }
        } else if (typeStr.includes('不计收支')) {
          // 忽略不计收支
        }
        
        if (isExp || isInc) {
           const existing = catMap.get(category) || { count: 0, amount: 0 };
           existing.count++;
           // If it's a refund (expense but negative), we should subtract from the category amount
           if (isExp && typeStr.includes('收入')) {
             existing.amount -= amount;
           } else {
             existing.amount += amount;
           }
           catMap.set(category, existing);
        }
      }
    }
  } 
  
  if (csvValidRows > 0) {
    if (!headerFound) {
      estimatedCount = csvValidRows;
      totalExpense = csvTotalExpense;
      totalIncome = csvTotalIncome;
    }
    expenses.sort((a, b) => b.amount - a.amount);
    incomes.sort((a, b) => b.amount - a.amount);
    top10Expense = expenses.slice(0, 10);
    top10Income = incomes.slice(0, 10);
    categoryBreakdown = Array.from(catMap.entries())
      .map(([category, { count, amount }]) => ({ category, count, amount }))
      .filter(c => c.amount > 0) // Remove categories with negative or zero amounts after refunds
      .sort((a, b) => b.amount - a.amount);
  } else if (!headerFound && estimatedCount === 0) {
    // 逐行正则匹配兜底
    for (const line of lines) {
      if (line.includes('支出') || line.includes('收入')) {
        const parts = line.split(',');
        let amount = 0;
        let type = '';
        let category = parts[1] || '';
        for (let i = 0; i < parts.length; i++) {
          if (parts[i] === '支出' || parts[i] === '收入') {
            type = parts[i];
            if (i + 1 < parts.length) {
              const parsedAmount = parseFloat(parts[i + 1].replace(/¥|,/g, ''));
              if (!isNaN(parsedAmount)) {
                amount = Math.abs(parsedAmount);
                break;
              }
            }
          }
        }
        if (amount > 0) {
          estimatedCount++;
          if (type === '支出') {
            totalExpense += amount;
          } else if (type === '收入') {
            if (category === "年度总收入" || category === "兼职收入" || category === "其他收入" || category.includes("收入")) {
              totalIncome += amount;
            } else {
              totalExpense -= amount;
            }
          }
        }
      }
    }
  }
  
  return { totalExpense, totalIncome, estimatedCount, top10Expense, top10Income, categoryBreakdown };
}

export async function generateDataSummary(
  rawText: string,
  apiKey: string,
  signal?: AbortSignal,
  userAnswers?: Record<string, string>,
  globalInstruction?: string
): Promise<DataSummary> {
  const sampleText = rawText.split("\n").slice(0, 300).join("\n");
  
  // 提取精确统计数据
  const exactStats = extractExactStats(rawText);

  let promptWithStats = SUMMARY_PROMPT;
  if (exactStats.estimatedCount > 0) {
    promptWithStats += `\n\n【基准统计数据】我已经为你计算了原始数据的精确统计，请以此为基准：\n- 预估记录数 (estimatedCount): ${exactStats.estimatedCount}\n- 预估总支出 (totalExpense): ${exactStats.totalExpense.toFixed(2)}\n- 预估总收入 (totalIncome): ${exactStats.totalIncome.toFixed(2)}\n\n注意：如果下方有【用户已确认信息】或【补充清洗口径】改变了某些记录的收支属性（如标记为不计收支，或收入改为支出），请在基准数据上进行加减调整，并输出调整后的最终总支出和总收入！`;
  }

  if (userAnswers && Object.keys(userAnswers).length > 0) {
    const answersText = Object.entries(userAnswers)
      .map(([id, ans]) => `用户对 ${id} 的回答：${ans}`)
      .join("\n");
    promptWithStats += `\n\n【用户已确认信息】请在统计和分类时严格应用以下用户确认的信息：\n${answersText}`;
  }
  
  if (globalInstruction && globalInstruction.trim()) {
    promptWithStats += `\n\n【补充清洗口径】请在统计和分类时严格应用以下全局清洗口径：\n${globalInstruction}`;
  }

  const hasCustomInstructions = (userAnswers && Object.keys(userAnswers).length > 0) || (globalInstruction && globalInstruction.trim().length > 0);

  const doRequest = async (): Promise<string> => {
    const res = await fetch(ALIYUN_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: ALIYUN_MODEL,
        messages: [
          { role: "system", content: promptWithStats },
          { role: "user", content: "原始数据：\n" + sampleText }
        ],
        temperature: 0.1,
      }),
      signal,
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(errBody || `API 错误: ${res.status}`);
    }
    const data = await res.json();
    const respCheck = validateAIResponse(data);
    if (!respCheck.valid) {
      throw new Error(respCheck.error ?? "API 返回异常");
    }
    return respCheck.text!.replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "").trim();
  };

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await doRequest();
      const parsed = tryParseJson(text);
      if (parsed) {
        // 强制覆盖为精确计算的数值，防止 AI 幻觉
        if (exactStats.estimatedCount > 0) {
          parsed.estimatedCount = exactStats.estimatedCount;
          
          // 如果用户没有提供自定义指令，我们才强制覆盖总金额和分类（因为自定义指令可能会改变这些）
          if (!hasCustomInstructions) {
            parsed.totalExpense = exactStats.totalExpense;
            parsed.totalIncome = exactStats.totalIncome;
            
            if (exactStats.top10Expense.length > 0) {
              parsed.top10Expense = exactStats.top10Expense;
            }
            if (exactStats.top10Income.length > 0) {
              parsed.top10Income = exactStats.top10Income;
            }
            if (exactStats.categoryBreakdown.length > 0) {
              parsed.categoryBreakdown = exactStats.categoryBreakdown;
            }
          }
        }
        return sanitizeDataSummary(parsed);
      }
      lastErr = new Error("AI 返回格式无法解析");
    } catch (err) {
      if (err instanceof Error && (err.message === "Aborted" || err.name === "AbortError")) {
        throw err;
      }
      lastErr = err;
    }
    if (attempt === 1) break;
  }
  reportSummaryParseError(sampleText, lastErr);
  return buildFallbackSummary(rawText, userAnswers, globalInstruction);
}

export async function auditForQuestions(
  rawText: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<AuditResult> {
  // 预检使用全部数据，确保每条记录都被检查
  const fullText = rawText.trim();

  const res = await fetch(ALIYUN_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: ALIYUN_MODEL,
      messages: [
        { role: "system", content: AUDIT_PROMPT },
        { role: "user", content: "原始数据（请逐条检查全部记录）：\n" + fullText }
      ],
      temperature: 0.1,
    }),
    signal,
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(errBody || `API 错误: ${res.status}`);
  }

  const data = await res.json();
  const respCheck = validateAIResponse(data);
  if (!respCheck.valid) {
    return { hasQuestions: false, questions: [] };
  }
  let text = respCheck.text!;
  text = text.replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "").trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { hasQuestions: false, questions: [] };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as { type?: string; questions?: unknown };
    if (parsed.type === "questions" && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      const questions = sanitizeAuditQuestions(parsed.questions);
      if (questions.length > 0) {
        return { hasQuestions: true, questions };
      }
    }
  } catch {
    /* ignore */
  }
  return { hasQuestions: false, questions: [] };
}

/** 每批行数，过大会导致 Gemini 输出被 MAX_TOKENS 截断，100 是一个速度与稳定性的良好平衡点 */
const DEFAULT_BATCH_LINES = 100;

/** 每批预计耗时（秒），用于进度提示 */
export const ESTIMATED_SEC_PER_BATCH = 15;

export function splitRawText(text: string, batchLines = DEFAULT_BATCH_LINES): string[] {
  const lines = text.split("\n");
  const batches: string[] = [];
  for (let i = 0; i < lines.length; i += batchLines) {
    batches.push(lines.slice(i, i + batchLines).join("\n"));
  }
  return batches;
}

export async function callAIClean(
  batchText: string,
  apiKey: string,
  rules: ImportRules,
  signal?: AbortSignal,
  userAnswers?: Record<string, string>,
  globalInstruction?: string
): Promise<string> {
  let systemPrompt = buildCleaningPrompt(rules);
  if (userAnswers && Object.keys(userAnswers).length > 0) {
    const answersText = Object.entries(userAnswers)
      .map(([id, ans]) => `用户对 ${id} 的回答：${ans}`)
      .join("\n");
    systemPrompt += `\n\n【用户已确认】请按以下用户回答处理数据：\n${answersText}`;
  }
  
  if (globalInstruction && globalInstruction.trim()) {
    systemPrompt += `\n\n【补充清洗口径】用户补充了以下全局清洗口径，请严格遵守并在数据清洗时应用：\n${globalInstruction}`;
  }

  const res = await fetch(ALIYUN_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: ALIYUN_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "以下是原始账单数据：\n" + batchText }
      ],
      temperature: 0.1,
    }),
    signal,
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(errBody || `API 错误: ${res.status}`);
  }

  const data = await res.json();
  const respCheck = validateAIResponse(data);
  if (!respCheck.valid) {
    console.warn(`[Bill-App AI导入] 清洗批次异常: ${respCheck.error}，该批跳过`);
    return "交易时间,精细分类,收支,金额,金额_净值,交易对方,商品说明,来源,必要性打标,备注\n";
  }
  let text = respCheck.text!;
  if (respCheck.finishReason === "length") {
    console.warn("AI 输出被长度限制截断，本批次可能不完整");
  }

  // Clean markdown code blocks if any
  text = text.replace(/^\`\`\`(?:csv)?\s*/i, "").replace(/\s*\`\`\`$/, "").trim();

  const csvCheck = validateAICsvOutput(text);
  if (!csvCheck.valid) {
    console.warn(`本批次 AI 输出异常: ${csvCheck.error}，该批将跳过`);
    return "交易时间,精细分类,收支,金额,金额_净值,交易对方,商品说明,来源,必要性打标,备注\n";
  }

  return text;
}

function safeRandomUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export async function processAIImport(
  rawText: string,
  apiKey: string,
  rules: ImportRules,
  onProgress?: (current: number, total: number) => void,
  signal?: AbortSignal,
  userAnswers?: Record<string, string>,
  globalInstruction?: string
): Promise<BillRecord[]> {
  const documentId = safeRandomUUID();

  // 如果输入已经是标准格式的 CSV（比如用户上传了之前导出的最终版），直接解析，跳过 AI 清洗以避免数据丢失
  const exactStats = extractExactStats(rawText);
  if (exactStats.estimatedCount > 0) {
    const lines = rawText.split("\n");
    const headerIndex = lines.findIndex(l => l.includes('金额') && (l.includes('收支') || l.includes('收/支') || l.includes('交易类型')));
    if (headerIndex !== -1) {
      const headerLine = lines[headerIndex];
      // 检查是否包含标准表头
      if (headerLine.includes('交易时间') && headerLine.includes('精细分类') && headerLine.includes('金额_净值')) {
        console.log("检测到标准格式 CSV，跳过 AI 清洗直接导入");
        const csvText = lines.slice(headerIndex).join('\n');
        const parsed = parseCsvText(csvText);
        if (parsed.data && parsed.data.length > 0) {
          onProgress?.(1, 1);
          const rawRecords = rowsToRecords(parsed.data, documentId);
          console.log(`[Debug] 快速通道 - 转换后未过滤记录:`, rawRecords);
          const records = rawRecords.filter(isValidBillRecord);
          console.log(`[Debug] 快速通道 - 过滤后有效记录:`, records);
          const dedup = new Map<string, BillRecord>();
          for (const record of records) {
            dedup.set(record.hash, record);
          }
          return [...dedup.values()];
        }
      }
    }
  }

  const batches = splitRawText(rawText, DEFAULT_BATCH_LINES);
  const allRecords: BillRecord[] = [];
  let completedBatches = 0;

  const EMPTY_CSV = "交易时间,精细分类,收支,金额,金额_净值,交易对方,商品说明,来源,必要性打标,备注\n";

  const processBatch = async (batchText: string, index: number): Promise<BillRecord[]> => {
    if (signal?.aborted) {
      throw new Error("Aborted");
    }

    let csvText: string;
    try {
      csvText = await callAIClean(batchText, apiKey, rules, signal, userAnswers, globalInstruction);
    } catch (err) {
      if (err instanceof Error && (err.message === "Aborted" || err.name === "AbortError")) {
        throw err;
      }
      console.warn(`[Bill-App AI导入] 批次 ${index + 1}/${batches.length} 失败，跳过:`, err);
      csvText = EMPTY_CSV;
    }

    // Parse CSV
    let parsed: any;
    try {
      parsed = parseCsvText(csvText);
    } catch (parseErr) {
      console.warn(`批次 ${index + 1}/${batches.length} 解析失败:`, parseErr);
      parsed = { data: [] };
    }
    
    console.log(`[Debug] 批次 ${index + 1} AI 返回原始文本:`, csvText);
    console.log(`[Debug] 批次 ${index + 1} 解析后数据:`, parsed.data);
    const csvCheck = validateParsedCsv(parsed);
    if (!csvCheck.valid) {
      console.warn(`批次 ${index + 1}/${batches.length} 表头校验失败: ${csvCheck.error}`);
    }
    const rawRecords = rowsToRecords(parsed.data, documentId);
    console.log(`[Debug] 批次 ${index + 1} 转换后未过滤记录:`, rawRecords);
    const records = rawRecords.filter(isValidBillRecord);
    console.log(`[Debug] 批次 ${index + 1} 过滤后有效记录:`, records);
    
    completedBatches++;
    onProgress?.(completedBatches, batches.length);
    
    return records;
  };

  // 并发处理：每次同时处理 3 个批次，避免触发 Gemini 免费版 15 RPM 的频率限制
  const CONCURRENCY = 3;
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const chunk = batches.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map((batchText, idx) => processBatch(batchText, i + idx))
    );
    for (const records of chunkResults) {
      allRecords.push(...records);
    }
  }

  // Deduplicate
  const dedup = new Map<string, BillRecord>();
  for (const record of allRecords) {
    dedup.set(record.hash, record);
  }

  return [...dedup.values()];
}

/** 根据原始文本估算批次数，用于进度提示 */
export function estimateBatchCount(text: string): number {
  return splitRawText(text).length;
}
