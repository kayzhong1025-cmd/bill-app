import { useState, useMemo } from "react";
import { X } from "lucide-react";
import type { BillRecord, BillType } from "../types/bill";

interface BatchEditModalProps {
  records: BillRecord[];
  onClose: () => void;
  onSave: (updatedRecords: BillRecord[]) => void;
  categoriesByType: { income: string[]; expense: string[] };
}

export default function BatchEditModal({ records, onClose, onSave, categoriesByType }: BatchEditModalProps) {
  const [type, setType] = useState<BillType | "">("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [description, setDescription] = useState("");

  const categories = useMemo(() => {
    if (type === "income") return categoriesByType.income;
    if (type === "expense") return categoriesByType.expense;
    return [...new Set([...categoriesByType.income, ...categoriesByType.expense])].sort();
  }, [type, categoriesByType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const updates: Partial<BillRecord> = {};
    if (type) updates.type = type;
    const amountNum = amount.trim() !== "" ? parseFloat(amount) : NaN;
    if (Number.isFinite(amountNum) && amountNum > 0) updates.amount = amountNum;
    if (category) updates.category = category;
    if (counterparty.trim() !== "") updates.counterparty = counterparty.trim() || "-";
    if (description.trim() !== "") updates.description = description.trim() || "无说明";

    if (Object.keys(updates).length === 0) {
      alert("请至少修改一项");
      return;
    }

    const updatedRecords = records.map((r) => ({
      ...r,
      ...updates,
      amount: updates.amount ?? r.amount,
      category: updates.category ?? r.category,
    })) as BillRecord[];

    onSave(updatedRecords);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">
            批量修改 ({records.length} 条)
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X size={20} />
          </button>
        </div>

        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          仅修改已填写的项，留空表示不修改
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">收支类型</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as BillType | "")}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              <option value="">保持不变</option>
              <option value="expense">支出</option>
              <option value="income">收入</option>
              <option value="transfer">不计收支</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">金额 (¥)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              placeholder="留空不修改"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">分类</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              <option value="">保持不变</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">交易对方</label>
            <input
              type="text"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              placeholder="留空不修改"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">商品说明</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              placeholder="留空不修改"
            />
          </div>

          <button
            type="submit"
            className="mt-6 w-full rounded-lg bg-blue-600 py-3 text-center font-bold text-white transition hover:bg-blue-500"
          >
            应用到 {records.length} 条
          </button>
        </form>
      </div>
    </div>
  );
}
