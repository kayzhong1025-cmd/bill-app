import { useState, useEffect } from "react";
import { Trash2, Download, FileText, Database, RotateCcw } from "lucide-react";
import type { BillRecord, DocumentMeta } from "../types/bill";
import { listBackups, restoreBackup, deleteBackup, type BackupRecord } from "../lib/storage";

const CSV_HEADERS = [
  "交易时间",
  "精细分类",
  "收支",
  "金额",
  "金额_净值",
  "交易对方",
  "商品说明",
  "来源",
  "必要性打标",
  "备注",
];

function recordToCsvRow(r: BillRecord): Record<string, string> {
  return {
    交易时间: r.timeStr ? `${r.dateStr} ${r.timeStr}` : r.dateStr,
    精细分类: r.category,
    收支: r.type === "expense" ? "支出" : r.type === "transfer" ? "不计收支" : "收入",
    金额: String(Math.abs(r.amount)),
    金额_净值: String(r.amount),
    交易对方: r.counterparty,
    商品说明: r.description,
    来源: r.source,
    必要性打标: r.necessity,
    备注: r.remark,
  };
}

function exportToCsv(records: BillRecord[], filename: string) {
  const rows = records.map(recordToCsvRow);
  const header = CSV_HEADERS.join(",");
  const lines = rows.map((r) =>
    CSV_HEADERS.map((h) => {
      const val = r[h] ?? "";
      const escaped = val.includes(",") || val.includes('"') ? `"${String(val).replace(/"/g, '""')}"` : val;
      return escaped;
    }).join(",")
  );
  const csv = [header, ...lines].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "export.csv";
  a.click();
  URL.revokeObjectURL(url);
}

interface DocumentsTabProps {
  documents: DocumentMeta[];
  rawData: BillRecord[];
  onDeleteDocument: (doc: DocumentMeta) => void;
  onRestoreBackup?: (rawData: BillRecord[], documents: DocumentMeta[]) => void;
}

function formatBackupTime(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return d.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function DocumentsTab({ documents, rawData, onDeleteDocument, onRestoreBackup }: DocumentsTabProps) {
  const [backups, setBackups] = useState<BackupRecord[]>([]);

  useEffect(() => {
    listBackups().then(setBackups);
  }, []);

  const handleRestore = async (backup: BackupRecord) => {
    if (!confirm(`确认恢复到 ${formatBackupTime(backup.timestamp)} 的备份？\n当前数据将被替换。`)) return;
    const data = await restoreBackup(backup.id);
    if (data && onRestoreBackup) {
      onRestoreBackup(data.rawData, data.documents);
      setBackups(await listBackups());
    }
  };

  const handleDeleteBackup = async (id: string) => {
    if (!confirm("确认删除此备份？")) return;
    await deleteBackup(id);
    setBackups(await listBackups());
  };
  const handleDelete = (doc: DocumentMeta) => {
    if (!confirm(`确认删除文档「${doc.name}」及其关联的 ${doc.recordCount} 条账单数据？`)) return;
    onDeleteDocument(doc);
  };

  const handleExport = (doc: DocumentMeta) => {
    const records = rawData.filter((r) => r.documentId === doc.id);
    const baseName = doc.name.replace(/\.csv$/i, "") || "export";
    exportToCsv(records, `${baseName}_导出.csv`);
  };

  const handleExportAll = () => {
    exportToCsv(rawData, `全部账单数据_导出.csv`);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Database size={20} className="text-slate-500" />
            数据备份与导出
          </h2>
          <button
            type="button"
            onClick={handleExportAll}
            disabled={rawData.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Download size={16} />
            导出全部数据 (CSV)
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          应用会每天自动备份数据，保留 1 份。可从备份恢复数据。
        </p>
        {backups.length === 0 ? (
          <p className="py-4 text-center text-slate-400">暂无备份记录</p>
        ) : (
          <div className="space-y-3">
            {backups.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50"
              >
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-200">
                    {formatBackupTime(b.timestamp)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {b.rawData.length} 条记录 · {b.documents.length} 个文档
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRestore(b)}
                    disabled={!onRestoreBackup}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-400 dark:hover:bg-blue-950"
                  >
                    <RotateCcw size={16} />
                    恢复
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteBackup(b.id)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-200 hover:text-red-500 dark:hover:bg-slate-700 dark:hover:text-red-400"
                    title="删除备份"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-lg font-bold">已上传文档</h2>
        {documents.length === 0 ? (
          <p className="py-8 text-center text-slate-400">暂无已上传的文档</p>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50"
              >
                <div className="flex items-center gap-3">
                  <FileText size={24} className="text-slate-400" />
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-200">{doc.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      导入时间: {doc.importDate} · 共 {doc.recordCount} 条记录
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleExport(doc)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <Download size={16} />
                    导出 CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(doc)}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-500 transition hover:bg-red-50 dark:border-red-800 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    <Trash2 size={16} />
                    删除数据
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
