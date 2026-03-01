import type { BillRecord, DashboardSummary, DashboardViewType, ComparisonData } from "../types/bill";

export function getFilteredRecords(data: BillRecord[], year: string, month: string, category?: string) {
  return data.filter(
    (item) =>
      (year === "all" || item.year === year) &&
      (month === "all" || item.month === month) &&
      (!category || category === "all" || item.category === category)
  );
}

export function getComparisonData(data: BillRecord[], year: string, month: string, category?: string): ComparisonData {
  if (year === "all") {
    return { momIncome: null, momExpense: null, yoyIncome: null, yoyExpense: null };
  }

  let momIncome: number | null = null;
  let momExpense: number | null = null;
  let yoyIncome: number | null = null;
  let yoyExpense: number | null = null;

  const currentSummary = getSummary(getFilteredRecords(data, year, month, category));

  // YoY calculation
  const prevYear = (parseInt(year) - 1).toString();
  const yoyRecords = getFilteredRecords(data, prevYear, month, category);
  const yoySummary = getSummary(yoyRecords);
  
  if (yoySummary.totalIncome > 0 || currentSummary.totalIncome > 0) {
    yoyIncome = yoySummary.totalIncome === 0 ? 100 : ((currentSummary.totalIncome - yoySummary.totalIncome) / yoySummary.totalIncome) * 100;
  }
  if (yoySummary.totalExpense > 0 || currentSummary.totalExpense > 0) {
    yoyExpense = yoySummary.totalExpense === 0 ? 100 : ((currentSummary.totalExpense - yoySummary.totalExpense) / yoySummary.totalExpense) * 100;
  }

  // MoM calculation (only if month is specific)
  if (month !== "all") {
    let prevMonthYear = parseInt(year);
    let prevMonth = parseInt(month) - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevMonthYear -= 1;
    }
    const prevMonthStr = prevMonth.toString().padStart(2, "0");
    const momRecords = getFilteredRecords(data, prevMonthYear.toString(), prevMonthStr, category);
    const momSummary = getSummary(momRecords);

    if (momSummary.totalIncome > 0 || currentSummary.totalIncome > 0) {
      momIncome = momSummary.totalIncome === 0 ? 100 : ((currentSummary.totalIncome - momSummary.totalIncome) / momSummary.totalIncome) * 100;
    }
    if (momSummary.totalExpense > 0 || currentSummary.totalExpense > 0) {
      momExpense = momSummary.totalExpense === 0 ? 100 : ((currentSummary.totalExpense - momSummary.totalExpense) / momSummary.totalExpense) * 100;
    }
  }

  return { momIncome, momExpense, yoyIncome, yoyExpense };
}

export function getSummary(records: BillRecord[]): DashboardSummary {
  const totalIncome = records.filter((r) => r.type === "income").reduce((sum, r) => sum + r.amount, 0);
  const totalExpense = records.filter((r) => r.type === "expense").reduce((sum, r) => sum + r.amount, 0);
  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
  };
}

export function getCategoriesForView(records: BillRecord[], viewType: DashboardViewType) {
  const targetType = viewType === "income" ? "income" : "expense";
  const group = new Map<string, number>();
  records
    .filter((r) => r.type === targetType)
    .forEach((r) => group.set(r.category, (group.get(r.category) ?? 0) + r.amount));
  return [...group.entries()]
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]);
}

export function getTrendData(
  records: BillRecord[],
  viewType: DashboardViewType,
  year: string,
  month: string
) {
  const targetType = viewType === "income" ? "income" : "expense";
  const group = new Map<string, number>();

  let keyFn: (r: BillRecord) => string;
  let labelFn: (k: string) => string;

  if (year === "all" && month === "all") {
    keyFn = (r) => `${r.year}-${r.month}`;
    labelFn = (k) => k;
  } else if (year !== "all" && month === "all") {
    keyFn = (r) => r.month;
    labelFn = (k) => `${parseInt(k)}月`;
  } else {
    keyFn = (r) => r.day;
    labelFn = (k) => `${parseInt(k)}日`;
  }

  records
    .filter((r) => r.type === targetType)
    .forEach((r) => {
      const key = keyFn(r);
      group.set(key, (group.get(key) ?? 0) + r.amount);
    });

  const sorted = [...group.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return {
    labels: sorted.map(([k]) => labelFn(k)),
    values: sorted.map(([, amount]) => amount),
  };
}

export function getTopRecords(records: BillRecord[], viewType: DashboardViewType) {
  const targetType = viewType === "income" ? "income" : "expense";
  return records
    .filter((r) => r.type === targetType && r.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);
}

export function toYearOptions(records: BillRecord[]) {
  return [...new Set(records.map((r) => r.year))].sort((a, b) => Number(b) - Number(a));
}

export function toCategoryOptions(records: BillRecord[], viewType: DashboardViewType) {
  const targetType = viewType === "income" ? "income" : "expense";
  return [...new Set(records.filter((r) => r.type === targetType).map((r) => r.category))].sort();
}
