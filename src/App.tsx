import { useEffect, useState, useCallback, useRef } from "react";
import { Download, PieChart, MessageSquareText, Upload, Copy, Check, HardDrive, WifiOff, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";
import { parseCsvText, rowsToRecords, validateCsvHeaders } from "./lib/csv";
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

type TabKey = "dashboard" | "trend" | "search" | "insight" | "documents";

const AI_PROMPT = `我有一份微信/支付宝账单文件，请帮我清洗并转换成标准化的 CSV 格式。

【必须严格按此表头输出】
交易时间,精细分类,收支,金额,金额_净值,交易对方,商品说明,来源,必要性打标,备注

【字段规则】
- 交易时间：保留原始格式，如 2026-02-17 10:13:53
- 精细分类（支出类）：餐饮美食 / 交通出行 / 日常购物 / 住房物业 / 娱乐消费 / 医疗健康 / 人情往来 / 其他支出
- 精细分类（收入类）：工资薪资 / 兼职收入 / 其他收入
- 收支：只填「收入」「支出」或「不计收支」（转账、充值等填「不计收支」）
- 金额：绝对值，正数，不含 ¥ 符号
- 金额_净值：支出填正数，收入填负数（如收入 5000 元填 -5000）
- 交易对方：原始交易对方名称
- 商品说明：商品名称或备注
- 来源：微信 或 支付宝
- 必要性打标：刚性支出 / 弹性支出 / 可选支出 / 不计收支
- 备注：留空即可

【过滤规则】跳过状态为「交易关闭」「已退款」「对方已退还」的记录

请只输出 CSV 内容，不要任何说明文字，不要代码块。`;

export default function App() {
  const [rawData, setRawData] = useState<BillRecord[]>([]);
  const [theme, setTheme] = useState<ThemeMode>("light");
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
  const [promptCopied, setPromptCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [data, docs, savedTheme] = await Promise.all([loadRawData(), loadDocuments(), loadTheme()]);
        setRawData(data);
        setDocuments(docs);

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
      } catch {
        setLoading(false);
      }
    })();
  }, []);

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

  const handleCopyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(AI_PROMPT);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, []);

  const yearOptions = toYearOptions(rawData);
  const recordsForCategoryOptions = getFilteredRecords(rawData, selectedYear, selectedMonth);
  const categoryOptions = toCategoryOptions(recordsForCategoryOptions);

  const filteredRecords = getFilteredRecords(rawData, selectedYear, selectedMonth, selectedCategory);
  const hasData = rawData.length > 0;

  const allCategories = Array.from(new Set(rawData.map((r) => r.category))).sort();
  const categoriesByType = {
    income: Array.from(new Set(rawData.filter((r) => r.type === "income").map((r) => r.category))).sort(),
    expense: Array.from(new Set(rawData.filter((r) => r.type === "expense").map((r) => r.category))).sort(),
    transfer: Array.from(new Set(rawData.filter((r) => r.type === "transfer").map((r) => r.category))).sort(),
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
          <div className="animate-fade-in">
            {/* 欢迎标题 */}
            <div className="mb-8 text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                <PieChart size={32} />
              </div>
              <h2 className="mb-2 text-3xl font-bold text-slate-800 dark:text-white">欢迎使用 Bill App</h2>
              <p className="text-slate-500 dark:text-slate-400">
                按照下面三步，将你的微信/支付宝账单导入系统，开始分析你的财务状况。
              </p>
            </div>

            {/* 三步引导卡片 */}
            <div className="mb-8 grid gap-4 md:grid-cols-3">
              {/* Step 1 */}
              <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                    1
                  </div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">导出原始账单</h3>
                </div>
                <div className="flex-1 space-y-3 text-sm text-slate-600 dark:text-slate-400">
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                    <p className="mb-1 font-medium text-slate-700 dark:text-slate-300">微信账单</p>
                    <p className="leading-relaxed">微信 → 我 → 服务 → 钱包 → 账单 → 右上角「…」→ 账单下载</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                    <p className="mb-1 font-medium text-slate-700 dark:text-slate-300">支付宝账单</p>
                    <p className="leading-relaxed">支付宝 → 首页「账单」→ 右上角「…」→ 开具交易流水证明</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                  <Download size={13} />
                  下载后得到 .csv 或 .xlsx 文件
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col rounded-2xl border border-violet-200 bg-white p-6 shadow-sm ring-1 ring-violet-100 dark:border-violet-800/50 dark:bg-slate-900 dark:ring-violet-900/30">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
                    2
                  </div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">用 AI 清洗数据</h3>
                </div>
                <div className="flex-1 space-y-3 text-sm text-slate-600 dark:text-slate-400">
                  <p>打开你常用的 AI 助手（如 <a href="https://kimi.aliyun.com" target="_blank" rel="noopener noreferrer" className="font-medium text-violet-600 hover:underline dark:text-violet-400">Kimi</a>、<a href="https://tongyi.aliyun.com" target="_blank" rel="noopener noreferrer" className="font-medium text-violet-600 hover:underline dark:text-violet-400">通义千问</a>、<a href="https://chatgpt.com" target="_blank" rel="noopener noreferrer" className="font-medium text-violet-600 hover:underline dark:text-violet-400">ChatGPT</a> 等），上传你的账单文件，然后发送下面这段提示词：</p>
                  <div className="relative rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                    <p className="line-clamp-3 font-mono text-xs leading-relaxed text-slate-500 dark:text-slate-500">
                      我有一份微信/支付宝账单文件，请帮我清洗并转换成标准化的 CSV 格式…
                    </p>
                    <button
                      type="button"
                      onClick={handleCopyPrompt}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500"
                    >
                      {promptCopied ? <Check size={12} /> : <Copy size={12} />}
                      {promptCopied ? "已复制" : "复制完整提示词"}
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                  <MessageSquareText size={13} />
                  AI 会输出标准格式的 CSV 内容
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                    3
                  </div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">导入 CSV 并分析</h3>
                </div>
                <div className="flex-1 space-y-3 text-sm text-slate-600 dark:text-slate-400">
                  <p>将 AI 生成的 CSV 内容保存为 <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs dark:bg-slate-800">.csv</code> 文件，然后点击右上角的「导入 CSV」按钮上传。</p>
                  <p>导入后即可查看：</p>
                  <ul className="space-y-1">
                    <li className="flex items-center gap-2"><Sparkles size={13} className="shrink-0 text-violet-500" /> 收支数据看板与趋势图</li>
                    <li className="flex items-center gap-2"><Sparkles size={13} className="shrink-0 text-violet-500" /> AI 财务洞见与改进建议</li>
                  </ul>
                </div>
                <div className="mt-4">
                  <ImportButton onImport={handleImport} />
                </div>
              </div>
            </div>

            {/* 分割线 + 次要操作 */}
            <div className="mb-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span className="text-xs text-slate-400">或者</span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="mb-10 flex justify-center gap-4">
              <button
                type="button"
                onClick={() => setIsRecordModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-violet-700 dark:hover:text-violet-400"
              >
                手动记录一笔账
                <ArrowRight size={14} />
              </button>
            </div>

            {/* 隐私说明 */}
            <div className="flex flex-wrap items-center justify-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-8 py-4 dark:border-slate-800 dark:bg-slate-800/40">
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
      </div>
    </div>
  );
}

function ImportButton({ onImport }: { onImport: (records: BillRecord[], documentMeta?: DocumentMeta) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function safeRandomUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

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
    <>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
      >
        <Upload size={15} />
        导入 CSV
      </button>
      <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
    </>
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
