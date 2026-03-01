import { Pencil, Trash2 } from "lucide-react";
import type { BillRecord } from "../../types/bill";

interface TopRecordsTableProps {
  records: BillRecord[];
  title: string;
  onEditRecord: (record: BillRecord) => void;
  onDeleteRecord: (record: BillRecord) => void;
}

function necessityStyle(necessity: string) {
  if (necessity.includes("刚需")) return "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
  if (necessity.includes("品质")) return "bg-pink-50 text-pink-600 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800";
  return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600";
}

export default function TopRecordsTable({ records, title, onEditRecord, onDeleteRecord }: TopRecordsTableProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-4 text-base font-semibold">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th className="pb-2 pr-4 font-semibold">日期</th>
              <th className="pb-2 pr-4 font-semibold">分类</th>
              <th className="pb-2 pr-4 font-semibold">交易对方</th>
              <th className="pb-2 pr-4 font-semibold">说明</th>
              <th className="pb-2 pr-4 font-semibold">必要性</th>
              <th className="pb-2 text-right font-semibold">金额 (¥)</th>
              <th className="pb-2 pr-2 font-semibold w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {records.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">暂无数据</td>
              </tr>
            ) : (
              records.map((r) => (
                <tr
                  key={r.hash}
                  onClick={() => onEditRecord(r)}
                  className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <td className="py-2 pr-4 text-slate-500">{r.dateStr}</td>
                  <td className="py-2 pr-4">
                    <span className="rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ring-slate-200 dark:ring-slate-700">
                      {r.category}
                    </span>
                  </td>
                  <td className="max-w-[100px] truncate py-2 pr-4 text-slate-600 dark:text-slate-300" title={r.counterparty}>
                    {r.counterparty}
                  </td>
                  <td className="max-w-[160px] truncate py-2 pr-4 text-slate-700 dark:text-slate-300" title={r.description}>
                    {r.description}
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`rounded border px-1.5 py-0.5 text-xs font-medium ${necessityStyle(r.necessity)}`}>
                      {r.necessity}
                    </span>
                  </td>
                  <td className="py-2 text-right font-semibold text-slate-900 dark:text-white">
                    ¥{r.amount.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onEditRecord(r); }}
                        className="rounded p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-blue-500 dark:hover:bg-slate-700 dark:hover:text-blue-400"
                        title="编辑"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDeleteRecord(r); }}
                        className="rounded p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-red-500 dark:hover:bg-slate-700 dark:hover:text-red-400"
                        title="删除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
