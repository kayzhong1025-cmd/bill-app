import { useEffect, useState, useCallback } from "react";
import { Sparkles, Download, PieChart, ArrowRight, ShieldCheck, HardDrive, WifiOff } from "lucide-react";
import { loadRawData, loadTheme, saveRawData, saveTheme, loadDocuments, saveDocuments, createBackup, listBackups } from "./lib/storage";
import { getFilteredRecords, toYearOptions, toCategoryOptions } from "./lib/analytics";
import type { BillRecord, DashboardViewType, ThemeMode, DocumentMeta } from "./types/bill";
import Header from "./components/Header";
import RecordModal from "./components/RecordModal";
import EditRecordModal from "./components/EditRecordModal";
import BatchEditModal from "./components/BatchEditModal";
import AICorrectModal from "./components/AICorrectModal";
import FilterBar from "./components/FilterBar";
import Dashboard from "./components/dashboard/Dashboard";
import TrendTab from "./components/TrendTab";
import SearchTab from "./components/SearchTab";
import DocumentsTab from "./components/DocumentsTab";
import InsightTab from "./components/InsightTab";
import HelpModal from "./components/HelpModal";
import AIImportPage from "./components/AIImportPage";

type TabKey = "dashboard" | "trend" | "search" | "insight" | "documents";

export default function App() {
  const [rawData, setRawData] = useState<BillRecord[]>([]);
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [viewType, setViewType] = useState<DashboardViewType>("expense");
  const [currentTab, setCurrentTab] = useState<TabKey>("dashboard");
  const [loading, setLoading] = useState(true);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BillRecord | null>(null);
  const [batchEditRecords, setBatchEditRecords] = useState<BillRecord[] | null>(null);
  const [aiCorrectRecords, setAiCorrectRecords] = useState<BillRecord[] | null>(null);
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [showAIImport, setShowAIImport] = useState(false);

  // Load persisted data, documents & theme on mount
  useEffect(() => {
    (async () => {
      try {
        const [data, docs, savedTheme] = await Promise.all([loadRawData(), loadDocuments(), loadTheme()]);
        setRawData(data);
        setDocuments(docs);
        
        // Auto-select latest year and month if data exists
        if (data.length > 0) {
          const latestRecord = [...data].sort((a, b) => b.dateStr.localeCompare(a.dateStr))[0];
          if (latestRecord) {
            setSelectedYear(latestRecord.year);
            setSelectedMonth(latestRecord.month);
          }
        }
        
        setTheme(savedTheme);
        applyThemeToDom(savedTheme);
        setLoading(false);

        // 首次加载后如有数据则备份（若今天尚未备份）
        if (data.length > 0) {
          try {
            const existing = await listBackups();
            const latest = existing[0];
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            if (!latest || latest.timestamp < todayStart.getTime()) {
              await createBackup(data, docs);
            }
          } catch {
            /* ignore */
          }
        }
      } catch (err) {
        setLoading(false); // maybe still set loading false
      }
    })();
  }, []);

  // 定期备份：每天一次
  const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
  useEffect(() => {
    if (rawData.length === 0) return;
    const id = setInterval(async () => {
      try {
        await createBackup(rawData, documents);
      } catch {
        /* ignore */
      }
    }, BACKUP_INTERVAL_MS);
    return () => clearInterval(id);
  }, [rawData, documents]);

  const applyThemeToDom = (t: ThemeMode) => {
    document.documentElement.classList.toggle("dark", t === "dark");
  };

  const handleToggleTheme = useCallback(async () => {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyThemeToDom(next);
    await saveTheme(next);
  }, [theme]);

  const handleImport = useCallback(async (newRecords: BillRecord[], documentMeta?: DocumentMeta) => {
    setRawData((prev) => {
      const existingHashes = new Set(prev.map((r) => r.hash));
      const toAdd = newRecords.filter((r) => !existingHashes.has(r.hash));
      if (toAdd.length === 0) return prev;
      
      const merged = [...prev, ...toAdd];
      
      // 异步保存数据，避免阻塞 UI 渲染
      setTimeout(() => {
        saveRawData(merged).catch(console.error);
        
        let latestRecord = merged[0];
        for (let i = 1; i < merged.length; i++) {
          if (merged[i].dateStr > latestRecord.dateStr) {
            latestRecord = merged[i];
          }
        }
        if (latestRecord) {
          setSelectedYear(latestRecord.year);
          setSelectedMonth(latestRecord.month);
        }
      }, 0);
      
      return merged;
    });
    
    if (documentMeta) {
      setDocuments((prev) => {
        const next = [...prev, documentMeta];
        setTimeout(() => saveDocuments(next).catch(console.error), 0);
        return next;
      });
    }
  }, []);

  const handleAddRecord = useCallback(async (newRecord: BillRecord) => {
    setRawData((prev) => {
      const merged = [...prev, newRecord];
      setTimeout(() => {
        saveRawData(merged).catch(console.error);
        setSelectedYear(newRecord.year);
        setSelectedMonth(newRecord.month);
      }, 0);
      return merged;
    });
    setIsRecordModalOpen(false);
  }, []);

  const handleClear = useCallback(async () => {
    if (!confirm("确认清空所有本地账单数据？")) return;
    setRawData([]);
    setDocuments([]);
    setSelectedYear("all");
    setSelectedMonth("all");
    setSelectedCategory("all");
    setTimeout(() => {
      saveRawData([]).catch(console.error);
      saveDocuments([]).catch(console.error);
    }, 0);
  }, []);

  const handleRestoreBackup = useCallback(async (data: BillRecord[], docs: DocumentMeta[]) => {
    setRawData(data);
    setDocuments(docs);
    setTimeout(() => {
      saveRawData(data).catch(console.error);
      saveDocuments(docs).catch(console.error);
      if (data.length > 0) {
        const latest = [...data].sort((a, b) => b.dateStr.localeCompare(a.dateStr))[0];
        if (latest) {
          setSelectedYear(latest.year);
          setSelectedMonth(latest.month);
        }
      }
    }, 0);
  }, []);

  const handleDeleteDocument = useCallback(async (doc: DocumentMeta) => {
    setRawData((prev) => {
      const remaining = prev.filter((r) => r.documentId !== doc.id);
      setTimeout(() => saveRawData(remaining).catch(console.error), 0);
      return remaining;
    });
    setDocuments((prev) => {
      const remaining = prev.filter((d) => d.id !== doc.id);
      setTimeout(() => saveDocuments(remaining).catch(console.error), 0);
      return remaining;
    });
  }, []);

  const handleUpdateRecord = useCallback(async (updatedRecord: BillRecord) => {
    setRawData((prev) => {
      const merged = prev.map((r) => (r.hash === updatedRecord.hash ? updatedRecord : r));
      setTimeout(() => saveRawData(merged).catch(console.error), 0);
      return merged;
    });
    setEditingRecord(null);
  }, []);

  const handleUpdateRecords = useCallback(async (updatedRecords: BillRecord[]) => {
    const hashSet = new Set(updatedRecords.map((r) => r.hash));
    setRawData((prev) => {
      const merged = prev.map((r) => (hashSet.has(r.hash) ? updatedRecords.find((u) => u.hash === r.hash)! : r));
      setTimeout(() => saveRawData(merged).catch(console.error), 0);
      return merged;
    });
    setBatchEditRecords(null);
  }, []);

  const handleAICorrectSave = useCallback(async (updatedRecords: BillRecord[]) => {
    const originalHashes = new Set(aiCorrectRecords ? aiCorrectRecords.map((r) => r.hash) : []);
    setRawData((prev) => {
      const withoutOriginal = prev.filter((r) => !originalHashes.has(r.hash));
      const dedup = new Map<string, BillRecord>();
      for (const r of [...withoutOriginal, ...updatedRecords]) {
        dedup.set(r.hash, r);
      }
      const merged = [...dedup.values()];
      setTimeout(() => saveRawData(merged).catch(console.error), 0);
      return merged;
    });
    setAiCorrectRecords(null);
  }, [aiCorrectRecords]);

  const handleDeleteRecord = useCallback((record: BillRecord) => {
    if (!confirm(`确认删除这条记录？\n${record.dateStr} ${record.counterparty} ¥${record.amount.toLocaleString("zh-CN")}`)) return;
    setRawData((prev) => {
      const remaining = prev.filter((r) => r.hash !== record.hash);
      setTimeout(() => saveRawData(remaining).catch(console.error), 0);
      return remaining;
    });
  }, []);

  const yearOptions = toYearOptions(rawData);
  const recordsForCategoryOptions = getFilteredRecords(rawData, selectedYear, selectedMonth);
  const categoryOptions = toCategoryOptions(recordsForCategoryOptions, viewType);
  
  const filteredRecords = getFilteredRecords(rawData, selectedYear, selectedMonth, selectedCategory);
  const hasData = rawData.length > 0;

  const allCategories = Array.from(new Set(rawData.map((r) => r.category))).sort();
  const categoriesByType = {
    income: Array.from(new Set(rawData.filter((r) => r.type === "income").map((r) => r.category))).sort(),
    expense: Array.from(new Set(rawData.filter((r) => r.type === "expense").map((r) => r.category))).sort(),
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">加载中...</div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-6 dark:bg-slate-950 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <Header 
            theme={theme} 
            onToggleTheme={handleToggleTheme} 
            onImport={handleImport} 
            onAddRecordClick={() => setIsRecordModalOpen(true)}
            onAIImportClick={() => setShowAIImport(true)}
          />
          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            className="shrink-0 rounded-full p-2.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            title="使用说明与技术实现"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <path d="M12 17h.01" />
            </svg>
          </button>
        </div>

        {hasData && (
          <div className="animate-fade-in">
            <FilterBar
              years={yearOptions}
              categories={categoryOptions}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              selectedCategory={selectedCategory}
              onYearChange={setSelectedYear}
              onMonthChange={setSelectedMonth}
              onCategoryChange={setSelectedCategory}
            />
            <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div className="flex flex-wrap gap-1 rounded-lg bg-slate-200 p-1 dark:bg-slate-800">
                <TabButton active={currentTab === "dashboard"} onClick={() => setCurrentTab("dashboard")} label="数据看板" />
                <TabButton active={currentTab === "trend"} onClick={() => setCurrentTab("trend")} label="趋势分析" />
                <TabButton active={currentTab === "search"} onClick={() => setCurrentTab("search")} label="明细搜索" />
                <TabButton active={currentTab === "insight"} onClick={() => setCurrentTab("insight")} label="AI 洞见" />
                <TabButton active={currentTab === "documents"} onClick={() => setCurrentTab("documents")} label="文档管理" />
              </div>
              <button
                type="button"
                onClick={handleClear}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-500 transition hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
              >
                清空数据
              </button>
            </div>
            
            {currentTab === "dashboard" && (
              <div className="animate-fade-in">
                <Dashboard
                  records={filteredRecords}
                  rawData={rawData}
                  viewType={viewType}
                  onViewTypeChange={setViewType}
                  isDark={theme === "dark"}
                  year={selectedYear}
                  month={selectedMonth}
                  onEditRecord={setEditingRecord}
                  onDeleteRecord={handleDeleteRecord}
                />
              </div>
            )}

            {currentTab === "trend" && (
              <div className="animate-fade-in">
                <TrendTab
                  records={filteredRecords}
                  selectedYear={selectedYear}
                  selectedMonth={selectedMonth}
                  isDark={theme === "dark"}
                  onEditRecord={setEditingRecord}
                  onDeleteRecord={handleDeleteRecord}
                />
              </div>
            )}

            {currentTab === "search" && (
              <div className="animate-fade-in">
                <SearchTab
                  records={getFilteredRecords(rawData, selectedYear, selectedMonth)}
                  onEditRecord={setEditingRecord}
                  onDeleteRecord={handleDeleteRecord}
                  onBatchEdit={setBatchEditRecords}
                  onAICorrect={setAiCorrectRecords}
                />
              </div>
            )}

            {currentTab === "insight" && (
              <div className="animate-fade-in">
                <InsightTab
                  records={rawData}
                  selectedYear={selectedYear}
                  selectedMonth={selectedMonth}
                />
              </div>
            )}

            {currentTab === "documents" && (
              <div className="animate-fade-in">
                <DocumentsTab
                  documents={documents}
                  rawData={rawData}
                  onDeleteDocument={handleDeleteDocument}
                  onRestoreBackup={handleRestoreBackup}
                />
              </div>
            )}
          </div>
        )}

        {!hasData && (
          <div className="animate-fade-in flex flex-col items-center justify-center rounded-3xl bg-white px-6 py-16 shadow-md ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 sm:px-16">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
              <Sparkles size={40} />
            </div>
            <h2 className="mb-4 text-3xl font-bold text-slate-800 dark:text-white">欢迎使用 Bill App</h2>
            <div className="mb-10 max-w-2xl text-center">
              <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300">
                记账是为了更好地记录生活，<strong className="font-semibold text-violet-600 dark:text-violet-400">无需时时紧绷</strong>。
              </p>
              <p className="mt-2 text-slate-500 dark:text-slate-400">
                不用每天为了几块钱强迫自己记账。你只需要养成<strong className="font-medium text-slate-700 dark:text-slate-200">定期（比如月末）导出账单并上传</strong>的习惯，剩下的繁琐整理、分类和复盘，全部交给 AI 帮你完成。
              </p>
            </div>

            <div className="mb-12 grid w-full max-w-4xl gap-6 sm:grid-cols-3">
              <div className="relative flex flex-col items-center rounded-2xl border border-slate-100 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-800/50">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                  <Download size={24} />
                </div>
                <h3 className="mb-2 font-bold text-slate-800 dark:text-slate-200">1. 导出原始账单</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">去微信或支付宝的账单页面，申请导出你的月度或年度账单文件。</p>
              </div>
              <div className="relative flex flex-col items-center rounded-2xl border border-slate-100 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-800/50">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                  <Sparkles size={24} />
                </div>
                <h3 className="mb-2 font-bold text-slate-800 dark:text-slate-200">2. AI 智能清洗</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">把文件扔进来，AI 会自动帮你分类、去重、剔除退款和无用流水。</p>
              </div>
              <div className="relative flex flex-col items-center rounded-2xl border border-slate-100 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-800/50">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <PieChart size={24} />
                </div>
                <h3 className="mb-2 font-bold text-slate-800 dark:text-slate-200">3. 洞见与复盘</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">通过多维看板和 AI 财务洞见，轻松掌握资金去向，复盘生活轨迹。</p>
              </div>
            </div>

            <button
              onClick={() => setShowAIImport(true)}
              className="group flex items-center gap-3 rounded-2xl bg-violet-600 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-violet-200 transition-all hover:-translate-y-1 hover:bg-violet-700 hover:shadow-xl dark:shadow-none"
            >
              <Sparkles size={24} className="transition-transform group-hover:rotate-12" />
              开始第一次 AI 导入
              <ArrowRight size={20} className="ml-1 transition-transform group-hover:translate-x-1" />
            </button>
            <p className="mt-6 text-sm text-slate-400">
              或者你也可以 <button onClick={() => setIsRecordModalOpen(true)} className="text-violet-500 hover:underline">手动记一笔</button>
            </p>

            {/* 隐私保障说明 */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-8 py-4 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <HardDrive size={15} className="shrink-0 text-emerald-500" />
                数据仅存储在<strong className="font-semibold text-slate-700 dark:text-slate-200">你的浏览器本地</strong>
              </div>
              <span className="hidden h-4 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <WifiOff size={15} className="shrink-0 text-emerald-500" />
                账单数据<strong className="font-semibold text-slate-700 dark:text-slate-200">不上传任何服务器</strong>
              </div>
              <span className="hidden h-4 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <ShieldCheck size={15} className="shrink-0 text-emerald-500" />
                关闭页面后数据仍<strong className="font-semibold text-slate-700 dark:text-slate-200">永久保留</strong>在本机
              </div>
            </div>
          </div>
        )}
        
        {isRecordModalOpen && (
          <RecordModal 
            onClose={() => setIsRecordModalOpen(false)} 
            onSave={handleAddRecord} 
            existingCategories={allCategories}
          />
        )}

        {editingRecord && (
          <EditRecordModal
            record={editingRecord}
            onClose={() => setEditingRecord(null)}
            onSave={handleUpdateRecord}
            existingCategories={allCategories}
            categoriesByType={categoriesByType}
          />
        )}

        {batchEditRecords && batchEditRecords.length > 0 && (
          <BatchEditModal
            records={batchEditRecords}
            onClose={() => setBatchEditRecords(null)}
            onSave={handleUpdateRecords}
            categoriesByType={categoriesByType}
          />
        )}

        {aiCorrectRecords && aiCorrectRecords.length > 0 && (
          <AICorrectModal
            records={aiCorrectRecords}
            onClose={() => setAiCorrectRecords(null)}
            onSave={handleAICorrectSave}
            apiKey={import.meta.env.VITE_GEMINI_API_KEY || ""}
          />
        )}

        {isHelpOpen && <HelpModal onClose={() => setIsHelpOpen(false)} />}

        {showAIImport && (
          <AIImportPage
            apiKey={import.meta.env.VITE_GEMINI_API_KEY || ""}
            onImport={(records, docMeta) => {
              handleImport(records, docMeta);
            }}
            onClose={() => setShowAIImport(false)}
          />
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-white text-violet-600 shadow dark:bg-slate-700 dark:text-violet-400"
          : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  );
}

