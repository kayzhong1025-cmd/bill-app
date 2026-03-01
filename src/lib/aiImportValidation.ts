/**
 * AI 导入流程的数据校验，确保各环节数据合法，避免错误或无法展示
 */
import type { BillRecord, CsvRow } from "../types/bill";
import type { DataSummary, TopItem, CategoryItem, AuditQuestion } from "./aiImport";
import { validateCsvHeaders } from "./csv";

/** 输入校验结果 */
export interface InputValidation {
  valid: boolean;
  error?: string;
}

/** 校验原始输入文本 */
export function validateRawInput(rawText: string): InputValidation {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { valid: false, error: "请输入或上传账单数据" };
  }
  const lines = trimmed.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 3) {
    return { valid: false, error: "数据过少，至少需要几行有效内容（如表头 + 数据行）" };
  }
  // 检查是否像账单数据（含常见关键词）
  const text = trimmed.toLowerCase();
  const hasBillLikeContent =
    /交易|金额|支出|收入|微信|支付宝|转账|收款|付款/.test(text) ||
    /^\d{4}[-/年]\d/.test(trimmed) ||
    lines.some((l) => /[\d.,]+\s*元?/.test(l));
  if (!hasBillLikeContent) {
    return { valid: false, error: "未识别到账单格式，请上传微信/支付宝导出的 CSV 或 Excel" };
  }
  return { valid: true };
}

/** 校验 API Key */
export function validateApiKey(apiKey: string): InputValidation {
  if (!apiKey || apiKey.trim().length < 10) {
    return { valid: false, error: "请先配置有效的 Gemini API Key" };
  }
  return { valid: true };
}

/** 校验 API 响应是否有效 (OpenAI 兼容格式) */
export function validateAIResponse(data: unknown): { valid: boolean; text?: string; error?: string; finishReason?: string } {
  if (!data || typeof data !== "object") {
    return { valid: false, error: "API 返回格式异常" };
  }
  const obj = data as Record<string, unknown>;
  const choices = obj.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return { valid: false, error: "AI 未返回有效内容，请重试" };
  }
  const choice = choices[0];
  if (!choice || typeof choice !== "object") {
    return { valid: false, error: "AI 未返回有效内容，请重试" };
  }
  const finishReason = (choice as Record<string, unknown>).finish_reason as string;
  if (finishReason === "content_filter") {
    return { valid: false, error: "内容被安全策略过滤，请检查输入数据", finishReason };
  }
  const message = (choice as Record<string, unknown>).message;
  const text = message && typeof message === "object" ? (message as Record<string, unknown>).content : undefined;
  if (text == null || (typeof text === "string" && text.trim().length === 0)) {
    return { valid: false, error: "AI 未返回有效内容，请重试", finishReason };
  }
  return { valid: true, text: typeof text === "string" ? text : String(text), finishReason };
}

/** 校验并清洗 DataSummary */
export function sanitizeDataSummary(parsed: Record<string, unknown>): DataSummary {
  const safeNum = (v: unknown, def: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : def;
  const safeStr = (v: unknown, def: string) =>
    typeof v === "string" && v.trim() ? v.trim() : def;
  const safeArr = <T>(v: unknown, guard: (x: unknown) => T | null): T[] =>
    Array.isArray(v) ? v.map(guard).filter(Boolean) as T[] : [];

  const sanitizeTopItem = (x: unknown): TopItem | null => {
    if (!x || typeof x !== "object") return null;
    const o = x as Record<string, unknown>;
    const amount = safeNum(o.amount, 0);
    const description = safeStr(o.description, "—");
    if (amount <= 0 || !description) return null;
    return {
      amount,
      description,
      date: typeof o.date === "string" ? o.date : undefined,
      type: o.type === "income" || o.type === "expense" || o.type === "transfer" ? o.type : undefined,
    };
  };

  const sanitizeCategoryItem = (x: unknown): CategoryItem | null => {
    if (!x || typeof x !== "object") return null;
    const o = x as Record<string, unknown>;
    const category = safeStr(o.category, "");
    const count = safeNum(o.count, 0);
    const amount = safeNum(o.amount, 0);
    if (!category) return null;
    return { category, count, amount };
  };

  return {
    estimatedCount: Math.max(0, Math.min(safeNum(parsed.estimatedCount, 0), 100000)),
    dateRange: safeStr(parsed.dateRange, "未知"),
    sources: safeArr(parsed.sources, (x) => (typeof x === "string" ? x : null)).filter(Boolean),
    noiseCount: Math.max(0, safeNum(parsed.noiseCount, 0)),
    qualityRating: ["可用", "部分可用", "建议不导入"].includes(
      safeStr(parsed.qualityRating, "")
    )
      ? (safeStr(parsed.qualityRating, "") as DataSummary["qualityRating"])
      : "部分可用",
    summaryText: safeStr(parsed.summaryText, "无总结"),
    totalExpense:
      typeof parsed.totalExpense === "number" && Number.isFinite(parsed.totalExpense)
        ? parsed.totalExpense
        : undefined,
    totalIncome:
      typeof parsed.totalIncome === "number" && Number.isFinite(parsed.totalIncome)
        ? parsed.totalIncome
        : undefined,
    top10Expense: safeArr(parsed.top10Expense, sanitizeTopItem).slice(0, 10),
    top10Income: safeArr(parsed.top10Income, sanitizeTopItem).slice(0, 10),
    categoryBreakdown: safeArr(parsed.categoryBreakdown, sanitizeCategoryItem),
    recordGuidance:
      typeof parsed.recordGuidance === "string" && parsed.recordGuidance.trim()
        ? parsed.recordGuidance.trim()
        : undefined,
  };
}

/** 校验并清洗 AuditQuestion */
export function sanitizeAuditQuestions(questions: unknown): AuditQuestion[] {
  if (!Array.isArray(questions) || questions.length === 0) return [];
  return questions
    .map((q, i) => {
      if (!q || typeof q !== "object") return null;
      const o = q as Record<string, unknown>;
      const question = typeof o.question === "string" ? o.question.trim() : "";
      if (!question) return null;
      return {
        id: typeof o.id === "string" ? o.id : `q${i + 1}`,
        question,
        context: typeof o.context === "string" ? o.context : undefined,
      };
    })
    .filter(Boolean) as AuditQuestion[];
}

/** 校验 AI 清洗输出的 CSV 是否可解析 */
export function validateAICsvOutput(csvText: string): { valid: boolean; error?: string } {
  const trimmed = csvText.trim();
  if (!trimmed) {
    return { valid: false, error: "本批次 AI 未返回有效内容，可能被截断" };
  }
  const lines = trimmed.split("\n").filter((l) => l.trim());
  if (lines.length < 2) {
    return { valid: false, error: "本批次返回数据过少，可能不完整" };
  }
  return { valid: true };
}

/** 校验单条 BillRecord 是否合法 */
export function isValidBillRecord(r: unknown): r is BillRecord {
  if (!r || typeof r !== "object") return false;
  const o = r as Record<string, unknown>;
  return (
    typeof o.hash === "string" &&
    o.hash.length > 0 &&
    (o.type === "income" || o.type === "expense" || o.type === "transfer") &&
    typeof o.dateStr === "string" &&
    /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(o.dateStr) &&
    typeof o.amount === "number" &&
    Number.isFinite(o.amount)
  );
}

/** 校验解析后的 CSV 是否有有效表头 */
export function validateParsedCsv(parsed: { data: CsvRow[]; meta?: { fields?: string[] } }): {
  valid: boolean;
  error?: string;
} {
  const rows = parsed.data ?? [];
  const headers =
    (parsed.meta as { fields?: string[] } | undefined)?.fields ??
    (rows[0] ? Object.keys(rows[0] as object) : []);
  const { valid, missing } = validateCsvHeaders(headers);
  if (!valid) {
    return {
      valid: false,
      error: `缺少必要列：${missing.join("、")}，AI 输出格式可能异常`,
    };
  }
  return { valid: true };
}
