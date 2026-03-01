import { useState, useMemo } from "react";
import { X } from "lucide-react";
import type { BillRecord, BillType } from "../types/bill";

interface EditRecordModalProps {
  record: BillRecord;
  onClose: () => void;
  onSave: (updatedRecord: BillRecord) => void;
  existingCategories: string[];
  categoriesByType?: Record<BillType, string[]>;
}

export default function EditRecordModal({ record, onClose, onSave, existingCategories, categoriesByType }: EditRecordModalProps) {
  const [type, setType] = useState<BillType>(record.type);
  const [amount, setAmount] = useState(Math.abs(record.amount).toString());
  const [category, setCategory] = useState(record.category);
  const [counterparty, setCounterparty] = useState(record.counterparty);
  const [description, setDescription] = useState(record.description);

  const categories = useMemo(() => {
    if (categoriesByType) {
      const byType = categoriesByType[type] ?? [];
      const set = new Set(byType);
      set.add(record.category);
      return Array.from(set).sort();
    }
    const set = new Set(existingCategories);
    set.add(record.category);
    return Array.from(set).sort();
  }, [existingCategories, record.category, type, categoriesByType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!category) {
      alert("请选择分类");
      return;
    }

    const amountNum = parseFloat(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      alert("请输入有效的金额（大于 0）");
      return;
    }

    const updatedRecord: BillRecord = {
      ...record,
      type,
      amount: amountNum,
      category,
      counterparty: counterparty.trim() || "-",
      description: description.trim() || "无说明",
    };

    onSave(updatedRecord);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">修改账单记录</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">收支类型</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as BillType)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
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
              placeholder="请输入金额"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">分类</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
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
              placeholder="请输入交易对方"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">商品说明</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              placeholder="请输入商品说明"
            />
          </div>

          <button
            type="submit"
            className="mt-6 w-full rounded-lg bg-blue-600 py-3 text-center font-bold text-white transition hover:bg-blue-500"
          >
            保存修改
          </button>
        </form>
      </div>
    </div>
  );
}
