import { X, Trash2 } from "lucide-react";
import type { BillRecord } from "../../types/bill";

interface DayRecordsModalProps {
  dateStr: string;
  records: BillRecord[];
  onClose: () => void;
  onEditRecord: (record: BillRecord) => void;
  onDeleteRecord: (record: BillRecord) => void;
}

export default function DayRecordsModal({ dateStr, records, onClose, onEditRecord, onDeleteRecord }: DayRecordsModalProps) {
  const dayRecords = records.filter((r) => r.dateStr === dateStr).sort((a, b) => b.amount - a.amount);
  const totalExpense = dayRecords.filter(r => r.type === "expense").reduce((sum, r) => sum + r.amount, 0);
  const totalIncome = dayRecords.filter(r => r.type === "income").reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-2xl max-h-[85vh] flex-col rounded-2xl bg-white shadow-xl dark:bg-slate-900">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">{dateStr} 收支明细</h2>
            <div className="mt-1 flex gap-4 text-sm font-medium">
              <span className="text-slate-500">共 {dayRecords.length} 笔</span>
              <span className="text-red-500">总支出: ¥{totalExpense.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</span>
              {totalIncome > 0 && (
                <span className="text-green-500">总收入: ¥{totalIncome.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="p-3 font-semibold">类型</th>
                  <th className="p-3 font-semibold">分类</th>
                  <th className="p-3 font-semibold">交易对方</th>
                  <th className="p-3 font-semibold">商品说明</th>
                  <th className="p-3 text-right font-semibold">金额 (¥)</th>
                  <th className="p-3 font-semibold w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dayRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">当天没有记账记录</td>
                  </tr>
                ) : (
                  dayRecords.map((r) => {
                    const isExp = r.type === "expense";
                    const isTransfer = r.type === "transfer";
                    const color = isExp ? "text-slate-900 dark:text-slate-200" : isTransfer ? "text-slate-500 dark:text-slate-400" : "text-green-600 dark:text-green-400";
                    const typeBg = isExp
                      ? "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      : isTransfer
                      ? "bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-300"
                      : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";

                    return (
                      <tr
                        key={r.hash}
                        onClick={() => onEditRecord(r)}
                        className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      >
                        <td className="whitespace-nowrap p-3">
                          <span className={`rounded px-2 py-1 text-xs font-medium ${typeBg}`}>
                            {isExp ? "支出" : isTransfer ? "不计收支" : "收入"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap p-3">{r.category}</td>
                        <td className="max-w-[120px] truncate p-3 text-slate-500 dark:text-slate-400" title={r.counterparty}>
                          {r.counterparty}
                        </td>
                        <td className="max-w-[150px] truncate p-3 text-slate-500 dark:text-slate-400" title={r.description}>
                          {r.description}
                        </td>
                        <td className={`whitespace-nowrap p-3 text-right font-medium ${color}`}>
                          {isExp ? (r.amount < 0 ? "+" : "-") : isTransfer ? "" : "+"}¥{Math.abs(r.amount).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onDeleteRecord(r); }}
                            className="rounded p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-red-500 dark:hover:bg-slate-700 dark:hover:text-red-400"
                            title="删除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}