import { useState, useMemo, useEffect } from "react";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import type { BillRecord } from "../types/bill";

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler);

import Heatmap from "./dashboard/Heatmap";
import DayRecordsModal from "./dashboard/DayRecordsModal";

interface TrendTabProps {
  records: BillRecord[];
  selectedYear: string;
  selectedMonth: string;
  isDark: boolean;
  onEditRecord: (record: BillRecord) => void;
  onDeleteRecord: (record: BillRecord) => void;
}

export default function TrendTab({ records, selectedYear, selectedMonth, isDark, onEditRecord, onDeleteRecord }: TrendTabProps) {
  const textColor = isDark ? "#94a3b8" : "#64748b";
  const gridColor = isDark ? "#1e293b" : "#f1f5f9";

  // Cash Flow Chart Data
  const { labels, incomeValues, expenseValues } = useMemo(() => {
    const sums = new Map<string, { income: number; expense: number }>();
    records.forEach((r) => {
      const key = `${r.year}-${r.month}`;
      const current = sums.get(key) || { income: 0, expense: 0 };
      if (r.type === "income") current.income += r.amount;
      else if (r.type === "expense") current.expense += r.amount;
      sums.set(key, current);
    });

    const sorted = [...sums.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return {
      labels: sorted.map(([k]) => k),
      incomeValues: sorted.map(([, v]) => v.income),
      expenseValues: sorted.map(([, v]) => v.expense),
    };
  }, [records]);

  const chartData: ChartData<"line"> = {
    labels,
    datasets: [
      {
        label: "收入",
        data: incomeValues,
        borderColor: "#34d399",
        backgroundColor: "rgba(52, 211, 153, 0.15)",
        fill: true,
        tension: 0.35,
        pointBackgroundColor: isDark ? "#0f172a" : "#ffffff",
        pointBorderColor: "#34d399",
        borderWidth: 2,
        pointRadius: 4,
      },
      {
        label: "支出",
        data: expenseValues,
        borderColor: "#f87171",
        backgroundColor: "rgba(248, 113, 113, 0.15)",
        fill: true,
        tension: 0.35,
        pointBackgroundColor: isDark ? "#0f172a" : "#ffffff",
        pointBorderColor: "#f87171",
        borderWidth: 2,
        pointRadius: 4,
      },
    ],
  };

  const chartOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { grid: { display: false }, ticks: { color: textColor } },
      y: {
        beginAtZero: true,
        grid: { color: gridColor },
        ticks: { color: textColor, callback: (val) => `¥${val}` },
      },
    },
    plugins: {
      legend: { position: "top", labels: { color: textColor } },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ¥${(ctx.parsed.y as number).toLocaleString("zh-CN")}`,
          footer: (tooltipItems) => {
            if (tooltipItems.length >= 2) {
              const income = tooltipItems.find(item => item.dataset.label === "收入")?.parsed.y || 0;
              const expense = tooltipItems.find(item => item.dataset.label === "支出")?.parsed.y || 0;
              const gap = income - expense;
              return ` 结余 (收入 - 支出): ¥${gap.toLocaleString("zh-CN")}`;
            }
            return "";
          },
        },
        footerFont: { weight: 'bold' },
        footerMarginTop: 8,
      },
      datalabels: { display: false },
    },
  };

  // Month Comparison - only months within filtered range
  const monthOptions = useMemo(() => {
    return [...new Set(records.map((r) => `${r.year}-${r.month}`))].sort().reverse();
  }, [records]);

  const [compareMonths, setCompareMonths] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    if (monthOptions.length === 0) return;
    setCompareMonths((prev) => {
      const valid = [...new Set(prev)].filter((m) => monthOptions.includes(m));
      if (valid.length >= 2) return valid;
      const def = [monthOptions[1] ?? monthOptions[0], monthOptions[0]].filter(Boolean);
      return [...new Set(def)];
    });
  }, [monthOptions.join(",")]);

  const toggleCompareMonth = (m: string) => {
    setCompareMonths((prev) => {
      const unique = [...new Set(prev)];
      const has = unique.includes(m);
      if (has) {
        const next = unique.filter((x) => x !== m);
        return next.length >= 2 ? next : prev;
      }
      return [...unique, m].sort().reverse();
    });
  };

  const comparison = useMemo(() => {
    const selected = [...new Set(compareMonths)].filter((m) => monthOptions.includes(m));
    if (selected.length < 2) return null;

    const monthData = selected.map((key) => {
      const [y, mo] = key.split("-");
      const data = records.filter((r) => r.type === "expense" && r.year === y && r.month === mo);
      const total = data.reduce((sum, r) => sum + r.amount, 0);
      const catMap = new Map<string, number>();
      data.forEach((r) => catMap.set(r.category, (catMap.get(r.category) || 0) + r.amount));
      return { key, total, catMap };
    });

    const allCats = new Set(monthData.flatMap((d) => [...d.catMap.keys()]));
    const totals = monthData.map((d) => d.total);
    const minTotal = Math.min(...totals);
    const maxTotal = Math.max(...totals);
    const avgTotal = totals.reduce((a, b) => a + b, 0) / totals.length;

    const catVolatility = [...allCats].map((cat) => {
      const amounts = monthData.map((d) => d.catMap.get(cat) || 0);
      const min = Math.min(...amounts);
      const max = Math.max(...amounts);
      const range = max - min;
      return { category: cat, amounts, min, max, range };
    }).sort((a, b) => b.range - a.range).slice(0, 5);

    return { monthData, minTotal, maxTotal, avgTotal, catVolatility };
  }, [records, compareMonths, monthOptions]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-lg font-bold">现金流分析 (收入 vs 支出)</h2>
        <div className="relative h-72 w-full">
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      <Heatmap
        records={records}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        onDayClick={setSelectedDay}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex flex-col gap-4">
          <h2 className="text-lg font-bold">收支对比</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            选择至少 2 个月份进行对比（点击切换选中）
          </p>
          <div className="flex flex-wrap gap-2">
            {monthOptions.map((m) => {
              const selected = compareMonths.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleCompareMonth(m)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    selected
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>

        {comparison && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/50">
                <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-400">总支出范围</h3>
                <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">
                  ¥{comparison.minTotal.toLocaleString("zh-CN", { minimumFractionDigits: 0 })} ~ ¥{comparison.maxTotal.toLocaleString("zh-CN", { minimumFractionDigits: 0 })}
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {comparison.monthData.length} 个月平均 ¥{comparison.avgTotal.toLocaleString("zh-CN", { minimumFractionDigits: 0 })}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/50">
                <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-400">各月总支出</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {comparison.monthData.map((d) => (
                    <div key={d.key} className="rounded-lg bg-white px-3 py-2 text-sm dark:bg-slate-900">
                      <span className="font-medium text-slate-600 dark:text-slate-400">{d.key}</span>
                      <span className="ml-2 font-bold text-slate-800 dark:text-slate-200">
                        ¥{d.total.toLocaleString("zh-CN", { minimumFractionDigits: 0 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-sm font-semibold text-slate-600 dark:text-slate-400">
                波动最大的分类 Top 5（跨月差异）
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="pb-2 text-left font-medium text-slate-600 dark:text-slate-400">分类</th>
                      {comparison.monthData.map((d, i) => (
                        <th key={`${d.key}-${i}`} className="pb-2 text-right font-medium text-slate-600 dark:text-slate-400">{d.key}</th>
                      ))}
                      <th className="pb-2 text-right font-medium text-slate-600 dark:text-slate-400">波动</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.catVolatility.map((row) => (
                      <tr key={row.category} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 font-medium text-slate-700 dark:text-slate-300" title={row.category}>
                          {row.category}
                        </td>
                        {row.amounts.map((amt, i) => (
                          <td key={i} className="py-2 text-right text-slate-600 dark:text-slate-400">
                            ¥{Math.round(amt).toLocaleString("zh-CN")}
                          </td>
                        ))}
                        <td className={`py-2 text-right font-semibold ${row.range > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-400"}`}>
                          ¥{Math.round(row.range).toLocaleString("zh-CN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedDay && (
        <DayRecordsModal
          dateStr={selectedDay}
          records={records}
          onClose={() => setSelectedDay(null)}
          onEditRecord={onEditRecord}
          onDeleteRecord={onDeleteRecord}
        />
      )}
    </div>
  );
}
