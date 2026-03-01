import Papa from "papaparse";
import type { BillRecord, CsvRow } from "../types/bill";

const MIN_REQUIRED = ["交易时间", "金额"] as const;
const ALT_MAP: Record<string, string[]> = {
  交易时间: ["日期", "时间"],
  收支类型: ["收支", "交易类型", "类型"],
  金额: ["金额_净值", "金额(元)", "金额"],
};

function normalizeDate(input?: string) {
  if (!input) return null;
  const partsArray = input.trim().split(/\s+/);
  const head = partsArray[0].replaceAll("年", "-").replaceAll("月", "-").replaceAll("日", "").replaceAll("/", "-");
  const timeStr = partsArray[1] || "";
  const parts = head.split("-").filter(Boolean);
  if (parts.length < 3) return null;
  const [year, month, day] = parts;
  return {
    dateStr: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
    timeStr,
    year,
    month: month.padStart(2, "0"),
    day: day.padStart(2, "0"),
  };
}

const cleanAmount = (val: string) => Number.parseFloat(val.replace(/[¥,]/g, ''));

function parseAmountAndType(row: CsvRow): { amount: number; type: "income" | "expense" | "transfer" } | null {
  const typeText = (row["收支类型"] ?? row["收支"] ?? row["交易类型"] ?? row["类型"])?.trim();
  const categoryText = (row["精细分类"] ?? row["分类"] ?? row["交易分类"] ?? "")?.trim();
  
  // 如果分类包含“理财”、“金融”、“基金”、“股票”、“提现”、“还款”、“借款”，强制标记为“不计收支” (transfer)
  // 移除了“充值”、“红包”、“零钱”、“转账”，因为它们可能是实际消费或需要冲抵的真实收支（如 AA 收款）
  const isFinancialTransfer = /理财|金融|基金|股票|提现|还款|借款/.test(categoryText);

  // 优先使用 "金额_净值"（与最终版对账单格式一致）
  const netRaw = row["金额_净值"];
  if (netRaw !== undefined && netRaw.trim() !== "") {
    const netValue = cleanAmount(netRaw);
    if (!Number.isNaN(netValue)) {
      if (isFinancialTransfer || (typeText && typeText.includes("不计收支"))) {
        return { amount: Math.abs(netValue), type: "transfer" };
      }
      // 净值 > 0 视为支出，净值 < 0 视为收入
      return {
        amount: Math.abs(netValue),
        type: netValue > 0 ? "expense" : netValue < 0 ? "income" : (typeText && typeText.includes("收入")) ? "income" : "expense",
      };
    }
  }

  // 仅接受：收入、支出、不计收支（与最终版对账单一致），其它如转账/交易关闭等忽略
  if (typeText && !typeText.includes("收入") && !typeText.includes("支出") && !typeText.includes("不计收支")) {
    return null; // 如果明确不是这三种类型，直接忽略，不再兜底为支出
  }

  if (isFinancialTransfer || (typeText && typeText.includes("不计收支"))) {
    const raw = row["金额"] || row["金额_净值"] || row["金额(元)"] || "0";
    const amount = Math.abs(cleanAmount(raw));
    if (!Number.isFinite(amount)) return null;
    return { amount, type: "transfer" };
  }

  // 退级使用 "金额" 和 "收支"
  const raw = row["金额"] || row["金额(元)"] || row["金额_净值"] || "0";
  const amount = Math.abs(cleanAmount(raw));
  if (!Number.isFinite(amount)) return null;

  if (typeText && typeText.includes("收入")) return { amount, type: "income" };
  if (typeText && typeText.includes("支出")) return { amount, type: "expense" };

  return null;
}

export function validateCsvHeaders(headers: string[]) {
  const exists = new Set(headers);
  const missing: string[] = [];
  for (const key of MIN_REQUIRED) {
    const alts = ALT_MAP[key] ?? [];
    const hasKey = exists.has(key) || alts.some((a) => exists.has(a)) || Array.from(exists).some(h => h.includes(key) || alts.some(a => h.includes(a)));
    if (!hasKey) missing.push(key);
  }
  return { valid: missing.length === 0, missing };
}

export function parseCsvText(csvText: string) {
  return Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
}

export function rowsToRecords(rows: CsvRow[], documentId?: string) {
  const parsed = rows
    .map((row): BillRecord | null => {
      const parsedAmt = parseAmountAndType(row);
      const date = normalizeDate(row["交易时间"] ?? row["日期"] ?? row["时间"]);
      if (!date || !parsedAmt) return null;

      let { amount, type } = parsedAmt;

      const category = (row["精细分类"] ?? row["审计分类"])?.trim() || "未分类";

      if (type === "income" && !(category === "年度总收入" || category === "兼职收入" || category === "其他收入" || category.includes("收入"))) {
        type = "expense";
        amount = -amount;
      }
      const descRaw = (row["商品说明"] ?? row["备注"] ?? row["交易对方"])?.trim() || "无说明";
      const description = descRaw.substring(0, 80);
      const counterparty = row["交易对方"]?.trim() || "-";
      const source = row["来源"]?.trim() || "-";
      const necessity = row["必要性打标"]?.trim() || "未打标";
      const remark = row["备注"]?.trim() || "";
      const hash = `${date.dateStr}_${type}_${amount}_${description}`;

      return {
        hash,
        type,
        dateStr: date.dateStr,
        timeStr: date.timeStr,
        year: date.year,
        month: date.month,
        day: date.day,
        category,
        amount,
        counterparty,
        description,
        source,
        necessity,
        remark,
        documentId,
      };
    })
    .filter(Boolean) as BillRecord[];

  const dedup = new Map<string, BillRecord>();
  for (const record of parsed) dedup.set(record.hash, record);
  return [...dedup.values()];
}
