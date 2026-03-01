import { Moon, Sun, Upload, Plus, Sparkles, ShieldCheck } from "lucide-react";
import { useRef } from "react";
import { parseCsvText, rowsToRecords, validateCsvHeaders } from "../lib/csv";
import type { BillRecord, ThemeMode, DocumentMeta } from "../types/bill";

interface HeaderProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onImport: (records: BillRecord[], documentMeta?: DocumentMeta) => void;
  onAddRecordClick: () => void;
  onAIImportClick: () => void;
}

function safeRandomUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export default function Header({ theme, onToggleTheme, onImport, onAddRecordClick, onAIImportClick }: HeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const csvText = await file.text();
    const parsed = parseCsvText(csvText);
    const headers = parsed.meta.fields ?? [];
    const validation = validateCsvHeaders(headers);
    if (!validation.valid) {
      alert(`CSV 缺少字段: ${validation.missing.join("、")}`);
      return;
    }

    const documentId = safeRandomUUID();
    const records = rowsToRecords(parsed.data, documentId);
    const documentMeta: DocumentMeta = {
      id: documentId,
      name: file.name,
      importDate: new Date().toISOString().slice(0, 10),
      recordCount: records.length,
    };
    onImport(records, documentMeta);
    event.target.value = "";
  };

  return (
    <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 border-t-4 border-t-violet-500 bg-white p-4 shadow-md dark:border-slate-800 dark:border-t-violet-500 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="bg-gradient-to-r from-violet-600 to-purple-500 bg-clip-text text-2xl font-bold text-transparent dark:from-violet-400 dark:to-purple-400">个人账单看板</h1>
        <div className="mt-1 flex items-center gap-2">
          <p className="text-sm text-slate-500 dark:text-slate-400">AI 驱动的个人账单分析工具</p>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800">
            <ShieldCheck size={11} />
            数据存本地
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggleTheme}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          type="button"
          onClick={onAddRecordClick}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <Plus size={16} />
          手动记账
        </button>
        <button
          type="button"
          onClick={onAIImportClick}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <Sparkles size={16} className="text-violet-500" />
          AI 智能导入
        </button>
        <button
          type="button"
          onClick={handleChooseFile}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500"
        >
          <Upload size={16} />
          导入 CSV
        </button>
        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
      </div>
    </header>
  );
}
