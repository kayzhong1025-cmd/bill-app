import type { BillRecord } from "../types/bill";
import { getFilteredRecords, getSummary } from "./analytics";

export function buildInsightContext(
  rawData: BillRecord[],
  year: string,
  month: string
): string {
  const records = getFilteredRecords(rawData, year, month);
  const summary = getSummary(records);

  const periodLabel =
    year === "all" && month === "all"
      ? "全部时间"
      : year === "all"
        ? `${month}月`
        : month === "all"
          ? `${year}年`
          : `${year}年${month}月`;

  const expenseByCategory = new Map<string, number>();
  const incomeByCategory = new Map<string, number>();
  records.forEach((r) => {
    const map = r.type === "expense" ? expenseByCategory : incomeByCategory;
    map.set(r.category, (map.get(r.category) ?? 0) + r.amount);
  });

  const topExpenseCats = [...expenseByCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([cat, amt]) => `${cat}: ¥${amt.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`);

  const topIncomeCats = [...incomeByCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([cat, amt]) => `${cat}: ¥${amt.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`);

  const topExpenseRecords = records
    .filter((r) => r.type === "expense")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map(
      (r) =>
        `${r.dateStr} ${r.category} ${r.counterparty} ¥${r.amount.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`
    );

  const monthlyTrend =
    year !== "all" && month === "all"
      ? (() => {
          const byMonth = new Map<string, { income: number; expense: number }>();
          for (let m = 1; m <= 12; m++) {
            const mStr = m.toString().padStart(2, "0");
            const mRecords = getFilteredRecords(rawData, year, mStr);
            const s = getSummary(mRecords);
            byMonth.set(mStr, { income: s.totalIncome, expense: s.totalExpense });
          }
          return [...byMonth.entries()]
            .map(
              ([m, v]) =>
                `${parseInt(m)}月: 收入¥${v.income.toLocaleString("zh-CN", { minimumFractionDigits: 0 })} 支出¥${v.expense.toLocaleString("zh-CN", { minimumFractionDigits: 0 })}`
            )
            .join("\n");
        })()
      : null;

  const yoyTrend =
    year !== "all"
      ? (() => {
          const prevYear = (parseInt(year) - 1).toString();
          const prevRecords =
            month === "all"
              ? getFilteredRecords(rawData, prevYear, "all")
              : getFilteredRecords(rawData, prevYear, month);
          const prevSummary = getSummary(prevRecords);
          return `去年同期: 收入¥${prevSummary.totalIncome.toLocaleString("zh-CN", { minimumFractionDigits: 2 })} 支出¥${prevSummary.totalExpense.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`;
        })()
      : null;

  let context = `
## 账单数据摘要 - ${periodLabel}

### 汇总
- 总收入: ¥${summary.totalIncome.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
- 总支出: ¥${summary.totalExpense.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
- 结余: ¥${summary.balance.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
- 记录数: ${records.length} 笔

### 支出分类 Top 10
${topExpenseCats.join("\n")}

### 收入分类 Top 10
${topIncomeCats.length > 0 ? topIncomeCats.join("\n") : "无"}

### 单笔最大支出 Top 5
${topExpenseRecords.join("\n")}
`;

  if (monthlyTrend) {
    context += `\n### ${year}年各月收支趋势\n${monthlyTrend}\n`;
  }
  if (yoyTrend) {
    context += `\n### 同比参考\n${yoyTrend}\n`;
  }

  return context.trim();
}
