export type ThemeMode = "light" | "dark";
export type BillType = "income" | "expense" | "transfer";
export type DashboardViewType = "income" | "expense";

export interface BillRecord {
  hash: string;
  type: BillType;
  dateStr: string;
  timeStr?: string;
  year: string;
  month: string;
  day: string;
  category: string;
  amount: number;
  counterparty: string;
  description: string;
  source: string;
  necessity: string;
  remark: string;
  documentId?: string; // Optional for backward compatibility with old records
}

export interface DocumentMeta {
  id: string;
  name: string;
  importDate: string;
  recordCount: number;
}

export interface CsvRow {
  交易时间?: string;
  日期?: string;
  时间?: string;
  精细分类?: string;
  审计分类?: string;
  收支类型?: string;
  收支?: string;
  交易类型?: string;
  类型?: string;
  金额?: string;
  "金额(元)"?: string;
  金额_净值?: string;
  交易对方?: string;
  商品说明?: string;
  来源?: string;
  必要性打标?: string;
  备注?: string;
}

export interface DashboardSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export interface ComparisonData {
  momIncome: number | null;
  momExpense: number | null;
  yoyIncome: number | null;
  yoyExpense: number | null;
}
