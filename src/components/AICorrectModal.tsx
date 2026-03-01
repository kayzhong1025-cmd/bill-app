import { useState } from "react";
import { X, Sparkles, Loader2 } from "lucide-react";
import type { BillRecord } from "../types/bill";
import { correctRecordsByInstruction } from "../lib/aiCorrect";

interface AICorrectModalProps {
  records: BillRecord[];
  onClose: () => void;
  onSave: (updatedRecords: BillRecord[]) => void;
  apiKey: string;
}

const EXAMPLES = [
  "把所有「餐饮美食」改成「交通通勤」",
  "把金额超过 1000 的支出分类改为「住房物业」",
  "把交易对方包含「美团」的记录分类改为「餐饮美食」",
  "合并重复记录并删除",
];

export default function AICorrectModal({ records, onClose, onSave, apiKey }: AICorrectModalProps) {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = instruction.trim();
    if (!trimmed) {
      setError("请描述你希望如何修正这些数据");
      return;
    }
    if (!apiKey) {
      setError("请先配置 Gemini API Key");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const updated = await correctRecordsByInstruction(records, trimmed, apiKey);
      onSave(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "修正失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-violet-100 p-2 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
              <Sparkles size={20} />
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
              AI 智能修正 ({records.length} 条)
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X size={20} />
          </button>
        </div>

        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          用自然语言描述你希望如何修正这些数据，AI 会按你的要求修改并应用。
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="例如：把所有餐饮美食改成交通通勤"
              rows={3}
              disabled={loading}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
            <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">示例指令</div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setInstruction(ex)}
                  disabled={loading}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 transition hover:border-violet-300 hover:bg-violet-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-violet-700 dark:hover:bg-violet-900/20"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-lg border border-slate-300 py-2.5 font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-600 py-2.5 font-medium text-white transition hover:bg-violet-500 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  AI 处理中...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  应用修正
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
