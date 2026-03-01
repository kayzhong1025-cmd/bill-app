import { useState } from "react";
import { X } from "lucide-react";
import type { BillRecord, BillType } from "../types/bill";

interface RecordModalProps {
  onClose: () => void;
  onSave: (record: BillRecord) => void;
  existingCategories: string[];
}

export default function RecordModal({ onClose, onSave, existingCategories }: RecordModalProps) {
  const [type, setType] = useState<BillType>("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
  const [category, setCategory] = useState(existingCategories[0] || "");
  const [customCategory, setCustomCategory] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      alert("请输入有效金额");
      return;
    }
    
    const finalCategory = customCategory.trim() || category;
    if (!finalCategory) {
      alert("请输入或选择分类");
      return;
    }

    const [year, month, day] = date.split("-");
    const numAmount = Number(amount);
    
    const hash = `manual_${Date.now()}_${type}_${numAmount}_${description}`;

    const newRecord: BillRecord = {
      hash,
      type,
      dateStr: date,
      year,
      month,
      day,
      category: finalCategory,
      amount: numAmount,
      counterparty: "手动录入",
      description: description || "无说明",
      source: "手动录入",
      necessity: "未打标",
      remark: "手动录入",
    };

    onSave(newRecord);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">手动记账</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4">
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 transition has-[:checked]:border-red-500 has-[:checked]:bg-red-50 has-[:checked]:text-red-600 dark:border-slate-700 dark:bg-slate-800 dark:has-[:checked]:border-red-500/50 dark:has-[:checked]:bg-red-500/10 dark:has-[:checked]:text-red-400">
              <input
                type="radio"
                name="type"
                value="expense"
                className="hidden"
                checked={type === "expense"}
                onChange={() => setType("expense")}
              />
              <span className="font-semibold">支出</span>
            </label>
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 transition has-[:checked]:border-green-500 has-[:checked]:bg-green-50 has-[:checked]:text-green-600 dark:border-slate-700 dark:bg-slate-800 dark:has-[:checked]:border-green-500/50 dark:has-[:checked]:bg-green-500/10 dark:has-[:checked]:text-green-400">
              <input
                type="radio"
                name="type"
                value="income"
                className="hidden"
                checked={type === "income"}
                onChange={() => setType("income")}
              />
              <span className="font-semibold">收入</span>
            </label>
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 transition has-[:checked]:border-slate-500 has-[:checked]:bg-slate-200 has-[:checked]:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:has-[:checked]:border-slate-500/50 dark:has-[:checked]:bg-slate-500/20 dark:has-[:checked]:text-slate-300">
              <input
                type="radio"
                name="type"
                value="transfer"
                className="hidden"
                checked={type === "transfer"}
                onChange={() => setType("transfer")}
              />
              <span className="font-semibold">不计收支</span>
            </label>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">金额</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">¥</span>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 pl-8 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">时间</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">分类</label>
            <div className="flex gap-2">
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setCustomCategory(""); // clear custom if selecting predefined
                }}
                className="flex-1 rounded-lg border border-slate-300 bg-slate-50 p-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              >
                {existingCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="">-- 自定义分类 --</option>
              </select>
              {category === "" && (
                <input
                  type="text"
                  required
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="输入新分类"
                  className="flex-1 rounded-lg border border-slate-300 bg-slate-50 p-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">说明 (可选)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              placeholder="这笔钱花哪了？"
            />
          </div>

          <button
            type="submit"
            className="mt-6 w-full rounded-lg bg-blue-600 py-3 text-center font-bold text-white transition hover:bg-blue-500"
          >
            保存记录
          </button>
        </form>
      </div>
    </div>
  );
}