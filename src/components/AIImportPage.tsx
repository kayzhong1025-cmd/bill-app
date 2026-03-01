import { useState, useRef, useEffect } from "react";
import { X, Upload, Loader2, CheckCircle2, AlertCircle, MessageCircleQuestion, Settings2, Plus, Trash2, ChevronRight, FileText, Database } from "lucide-react";
import * as XLSX from "xlsx";
import type { BillRecord, DocumentMeta } from "../types/bill";
import { auditForQuestions, processAIImport, generateDataSummary, estimateBatchCount, ESTIMATED_SEC_PER_BATCH, type AuditQuestion, type DataSummary } from "../lib/aiImport";
import { validateRawInput, validateApiKey } from "../lib/aiImportValidation";
import { reportApiError } from "../lib/aiImportErrorReporter";
import { loadImportRules, saveImportRules, type ImportRules, type PersonalRule } from "../lib/importRules";

interface AIImportPageProps {
  apiKey: string;
  onImport: (records: BillRecord[], docMeta: DocumentMeta) => void;
  onClose: () => void;
}

function safeRandomUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export default function AIImportPage({ apiKey, onImport, onClose }: AIImportPageProps) {
  // === Rules State ===
  const [rules, setRules] = useState<ImportRules>(loadImportRules());
  
  // Save rules whenever they change
  useEffect(() => {
    saveImportRules(rules);
  }, [rules]);

  // === Workflow State ===
  // 1: Input, 2: Auditing, 3: Questions, 4: Summarizing, 5: Summary View, 6: Processing, 7: Preview, 8: Done
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8>(1);
  const [rawText, setRawText] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<BillRecord[]>([]);
  const [questions, setQuestions] = useState<AuditQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<DataSummary | null>(null);
  const [globalInstruction, setGlobalInstruction] = useState("");
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);

  // === Handlers ===
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsReadingFile(true);
    setError(null);
    try {
      let combinedText = "";
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isCsv = file.name.toLowerCase().endsWith(".csv");
        let csv: string;
        if (isCsv) {
          // Detect encoding for CSV files (GBK vs UTF-8)
          const buffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(buffer);
          
          // Simple heuristic: check if there are many bytes > 127 which might indicate GBK
          // A more robust way is to try decoding as UTF-8, and if it fails or has many replacement chars, fallback to GBK.
          const decoderUtf8 = new TextDecoder('utf-8', { fatal: true });
          try {
            csv = decoderUtf8.decode(uint8Array);
          } catch (e) {
            // If UTF-8 decoding fails, fallback to GBK (common for Chinese CSVs from Alipay/WeChat)
            const decoderGbk = new TextDecoder('gbk');
            csv = decoderGbk.decode(uint8Array);
          }
        } else {
          const data = await file.arrayBuffer();
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          csv = XLSX.utils.sheet_to_csv(worksheet, { forceQuotes: true });
        }
        combinedText += `\n--- 文件: ${file.name} ---\n` + csv + "\n";
      }
      setRawText((prev) => (prev ? prev + "\n" + combinedText : combinedText));
    } catch (err) {
      console.error(err);
      setError("读取文件失败，请确保文件格式正确 (Excel/CSV)");
    } finally {
      setIsReadingFile(false);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleStart = async () => {
    setError(null);
    const inputCheck = validateRawInput(rawText);
    if (!inputCheck.valid) {
      setError(inputCheck.error ?? "输入数据无效");
      return;
    }
    
    // 如果是标准格式 CSV，跳过 API Key 校验，直接进入概览和导入
    const isStandardCsv = rawText.includes('金额_净值') && rawText.includes('精细分类');
    if (!isStandardCsv) {
      const keyCheck = validateApiKey(apiKey);
      if (!keyCheck.valid) {
        setError(keyCheck.error ?? "API Key 无效");
        return;
      }
    }

    setStep(2);
    setError(null);
    abortControllerRef.current = new AbortController();

    try {
      if (isStandardCsv) {
        // 标准格式直接跳过预检，进入概览
        await runSummary();
      } else {
        const audit = await auditForQuestions(rawText, apiKey, abortControllerRef.current.signal);
        
        if (audit.hasQuestions && audit.questions.length > 0) {
          setQuestions(audit.questions);
          setAnswers(Object.fromEntries(audit.questions.map((q) => [q.id, ""])));
          // 先生成概览数据存起来，但不跳转页面
          generateDataSummary(rawText, apiKey, abortControllerRef.current.signal)
            .then(res => setSummary(res))
            .catch(console.error);
            
          setStep(3); // 进入问题确认页
        } else {
          await runSummary(); // 没有问题，直接跑概览并进入概览页
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && (err.message === "Aborted" || err.name === "AbortError")) {
        setStep(1);
      } else {
        reportApiError("预检", err);
        setError("预检遇到问题，请重试");
        setStep(1);
      }
    }
  };

  const runSummary = async () => {
    setStep(4);
    setError(null);
    abortControllerRef.current = new AbortController();

    try {
      const isStandardCsv = rawText.includes('金额_净值') && rawText.includes('精细分类');
      if (isStandardCsv && (!apiKey || apiKey.length < 10)) {
        // 如果是标准 CSV 且没有 API key，直接走 fallback 逻辑，不调 API
        const { generateDataSummary: fallbackGen } = await import('../lib/aiImport');
        const result = await fallbackGen(rawText, 'dummy_key', abortControllerRef.current.signal);
        setSummary(result);
        setStep(5);
        return;
      }
      
      const result = await generateDataSummary(rawText, apiKey, abortControllerRef.current.signal);
      setSummary(result);
      setStep(5);
    } catch (err: unknown) {
      // 如果是标准格式 CSV，即使 API 失败也应该能通过 fallback 构建概览
      const isStandardCsv = rawText.includes('金额_净值') && rawText.includes('精细分类');
      if (isStandardCsv) {
        // 强制使用 fallback 构建概览
        const { generateDataSummary: fallbackGen } = await import('../lib/aiImport');
        // 传一个假的 key 让它失败然后走 fallback
        const result = await fallbackGen(rawText, 'dummy_key_to_force_fallback', abortControllerRef.current.signal);
        setSummary(result);
        setStep(5);
        return;
      }
      
      if (err instanceof Error && (err.message === "Aborted" || err.name === "AbortError")) {
        setStep(questions.length > 0 ? 3 : 1);
      } else {
        reportApiError("生成概览", err);
        setError("生成概览遇到问题，请重试");
        setStep(questions.length > 0 ? 3 : 1);
      }
    }
  };

  const handleConfirmQuestions = () => {
    // 如果概览已经生成好了，直接跳过去；否则显示 loading
    if (summary) {
      setStep(5);
    } else {
      runSummary();
    }
  };

  const runProcessing = async () => {
    setStep(6);
    setError(null);
    abortControllerRef.current = new AbortController();

    const filledAnswers = Object.fromEntries(
      Object.entries(answers).filter(([, v]) => v.trim() !== "")
    );

    try {
      const result = await processAIImport(
        rawText,
        apiKey,
        rules,
        (current, total) => setProgress({ current, total }),
        abortControllerRef.current.signal,
        filledAnswers,
        globalInstruction
      );
      setRecords(result);
      setStep(7);
    } catch (err: unknown) {
      if (err instanceof Error && (err.message === "Aborted" || err.name === "AbortError")) {
        setStep(5);
      } else {
        reportApiError("数据清洗", err);
        setError(`数据清洗遇到问题，请重试: ${err instanceof Error ? err.message : String(err)}`);
        setStep(5);
      }
    }
  };

  const handleCancel = () => {
    abortControllerRef.current?.abort();
  };

  const handleImportConfirm = () => {
    if (records.length === 0) {
      setError("没有解析到任何记录");
      return;
    }

    const docMeta: DocumentMeta = {
      id: safeRandomUUID(),
      name: `AI导入_${new Date().toLocaleString("zh-CN")}`,
      importDate: new Date().toISOString(),
      recordCount: records.length,
    };

    onImport(records, docMeta);
    setStep(8);
  };

  // === Rules Handlers ===
  const toggleCoreRule = (id: string) => {
    setRules(prev => ({
      ...prev,
      coreRules: prev.coreRules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r)
    }));
  };

  const updateCoreRuleDesc = (id: string, desc: string) => {
    setRules(prev => ({
      ...prev,
      coreRules: prev.coreRules.map(r => r.id === id ? { ...r, description: desc } : r)
    }));
  };

  const togglePersonalRule = (id: string) => {
    setRules(prev => ({
      ...prev,
      personalRules: prev.personalRules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r)
    }));
  };

  const addKeyword = (ruleId: string, keyword: string) => {
    if (!keyword.trim()) return;
    setRules(prev => ({
      ...prev,
      personalRules: prev.personalRules.map(r => {
        if (r.id === ruleId && !r.keywords.includes(keyword.trim())) {
          return { ...r, keywords: [...r.keywords, keyword.trim()] };
        }
        return r;
      })
    }));
  };

  const removeKeyword = (ruleId: string, keyword: string) => {
    setRules(prev => ({
      ...prev,
      personalRules: prev.personalRules.map(r => {
        if (r.id === ruleId) {
          return { ...r, keywords: r.keywords.filter(k => k !== keyword) };
        }
        return r;
      })
    }));
  };

  const updateCategoryName = (ruleId: string, name: string) => {
    setRules(prev => ({
      ...prev,
      personalRules: prev.personalRules.map(r => r.id === ruleId ? { ...r, category: name } : r)
    }));
  };

  const addPersonalRule = () => {
    const newRule: PersonalRule = {
      id: `rule_${Date.now()}`,
      category: "新分类",
      keywords: [],
      enabled: true
    };
    setRules(prev => ({
      ...prev,
      personalRules: [...prev.personalRules, newRule]
    }));
  };

  const deletePersonalRule = (id: string) => {
    setRules(prev => ({
      ...prev,
      personalRules: prev.personalRules.filter(r => r.id !== id)
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-slate-50 dark:bg-slate-950">
      {/* Left Panel: Rules */}
      <div className="w-1/3 min-w-[350px] max-w-[450px] border-r border-slate-200 bg-white flex flex-col dark:border-slate-800 dark:bg-slate-900">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="p-2 bg-violet-100 text-violet-600 rounded-lg dark:bg-violet-900/30 dark:text-violet-400">
            <Settings2 size={20} />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 dark:text-white">数据清洗规则</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">修改后自动保存，将注入 AI 处理指令</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-8">
          {/* Core Rules */}
          <section>
            <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2 dark:text-slate-200">
              <Database size={16} className="text-violet-500" />
              核心审计规则
            </h3>
            <div className="space-y-4">
              {rules.coreRules.map(rule => (
                <div key={rule.id} className={`p-4 rounded-xl border transition-colors ${rule.enabled ? 'border-violet-100 bg-violet-50/30 dark:border-violet-900/30 dark:bg-violet-900/10' : 'border-slate-200 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-800/50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm text-slate-700 dark:text-slate-300">{rule.label}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={rule.enabled} onChange={() => toggleCoreRule(rule.id)} />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-violet-600"></div>
                    </label>
                  </div>
                  <textarea
                    value={rule.description}
                    onChange={(e) => updateCoreRuleDesc(rule.id, e.target.value)}
                    disabled={!rule.enabled}
                    className="w-full text-xs text-slate-600 bg-transparent border-none resize-none focus:ring-0 p-0 h-16 dark:text-slate-400 disabled:cursor-not-allowed"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Personal Rules */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 dark:text-slate-200">
                <FileText size={16} className="text-emerald-500" />
                个性化业务规则
              </h3>
              <button onClick={addPersonalRule} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded dark:text-emerald-400 dark:hover:bg-emerald-900/30">
                <Plus size={16} />
              </button>
            </div>
            <div className="space-y-4">
              {rules.personalRules.map(rule => (
                <div key={rule.id} className={`p-4 rounded-xl border transition-colors ${rule.enabled ? 'border-emerald-100 bg-emerald-50/30 dark:border-emerald-900/30 dark:bg-emerald-900/10' : 'border-slate-200 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-800/50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <input
                      type="text"
                      value={rule.category}
                      onChange={(e) => updateCategoryName(rule.id, e.target.value)}
                      disabled={!rule.enabled}
                      className="font-medium text-sm text-slate-700 bg-transparent border-none focus:ring-0 p-0 dark:text-slate-300 w-32 disabled:cursor-not-allowed"
                    />
                    <div className="flex items-center gap-2">
                      <button onClick={() => deletePersonalRule(rule.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={rule.enabled} onChange={() => togglePersonalRule(rule.id)} />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-1.5">
                    {rule.keywords.map(kw => (
                      <span key={kw} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-200 text-xs text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                        {kw}
                        {rule.enabled && (
                          <button onClick={() => removeKeyword(rule.id, kw)} className="hover:text-red-500">
                            <X size={12} />
                          </button>
                        )}
                      </span>
                    ))}
                    {rule.enabled && (
                      <input
                        type="text"
                        placeholder="+ 添加关键词"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addKeyword(rule.id, e.currentTarget.value);
                            e.currentTarget.value = '';
                          }
                        }}
                        className="inline-flex w-24 px-2 py-1 rounded bg-transparent border border-dashed border-slate-300 text-xs focus:outline-none focus:border-emerald-500 dark:border-slate-600 dark:text-slate-300"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Right Panel: Workflow */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors z-10 dark:hover:bg-slate-800"
        >
          <X size={24} />
        </button>

        <div className="flex-1 overflow-y-auto p-10 lg:p-16">
          <div className="max-w-3xl mx-auto">
            
            {/* Step Indicators */}
            <div className="flex items-center justify-between mb-12 relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-slate-200 dark:bg-slate-800 -z-10"></div>
              {[
                { s: 1, label: "输入数据" },
                { s: 3, label: "确认问题" },
                { s: 5, label: "数据概览" },
                { s: 7, label: "明细预览" }
              ].map((item) => {
                const isActive = step >= item.s;
                const isCurrent = step === item.s || step === item.s - 1;
                return (
                  <div key={item.s} className="flex flex-col items-center gap-2 bg-slate-50 dark:bg-slate-950 px-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                      isActive ? 'bg-violet-600 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    } ${isCurrent ? 'ring-4 ring-violet-100 dark:ring-violet-900/30' : ''}`}>
                      {isActive && step > item.s + 1 ? <CheckCircle2 size={16} /> : (item.s + 1) / 2}
                    </div>
                    <span className={`text-xs font-medium ${isActive ? 'text-violet-700 dark:text-violet-400' : 'text-slate-400'}`}>
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 dark:bg-slate-900 dark:border-slate-800">
              
              {step === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">导入原始账单</h2>
                    <p className="text-slate-500 dark:text-slate-400">粘贴文本或上传微信/支付宝导出的账单文件，AI 将自动清洗</p>
                    {rawText.trim() && (() => {
                      const lines = rawText.split("\n").length;
                      const batches = estimateBatchCount(rawText);
                      const mins = batches > 0 ? Math.max(1, Math.ceil(batches * ESTIMATED_SEC_PER_BATCH / 60)) : 0;
                      return lines > 0 ? (
                        <p className="mt-3 text-sm text-violet-600 dark:text-violet-400 font-medium">
                          约 {lines} 行 · 预计分 {batches} 批处理 · 全量清洗约 {mins} 分钟
                        </p>
                      ) : null;
                    })()}
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex justify-end">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        multiple
                        accept=".csv,.xlsx,.xls"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isReadingFile}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"
                      >
                        {isReadingFile ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        {isReadingFile ? "正在读取文件..." : "上传文件"}
                      </button>
                    </div>
                    {isReadingFile && (
                      <div className="w-full bg-slate-100 rounded-full h-2 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full w-1/3 bg-violet-600 rounded-full"
                          style={{ animation: "indeterminate 1.5s ease-in-out infinite" }}
                        />
                      </div>
                    )}
                  </div>

                  <textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="在此粘贴账单内容..."
                    className="h-64 w-full rounded-xl border border-slate-300 p-4 font-mono text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />

                  {error && (
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                      <AlertCircle className="h-5 w-5" />
                      <span className="text-sm">{error}</span>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      onClick={handleStart}
                      disabled={!rawText.trim()}
                      className="rounded-xl bg-violet-600 px-8 py-3 font-medium text-white hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      开始分析 <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              )}

              {(step === 2 || step === 4 || step === 6) && (
                <div className="flex flex-col items-center justify-center py-20 space-y-6 animate-in fade-in">
                  <Loader2 className="h-12 w-12 animate-spin text-violet-600" />
                  <div className="text-center">
                    <h3 className="text-xl font-medium dark:text-white mb-2">
                      {step === 2 ? "AI 正在预检数据..." : step === 4 ? "正在生成数据概览..." : "AI 正在努力清洗数据..."}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400">
                      {step === 2 ? "检查是否有需要您确认的事项，请稍候..." : step === 4 ? "评估数据质量和规模，请稍候..." : `正在处理第 ${progress.current} / ${progress.total} 批次 · 预计剩余约 ${Math.max(0, (progress.total - progress.current) * ESTIMATED_SEC_PER_BATCH)} 秒`}
                    </p>
                  </div>
                  {(step === 2 || step === 4) && (
                    <div className="w-full max-w-md space-y-2">
                      <div className="text-sm text-slate-600 dark:text-slate-400 text-center">处理中</div>
                      <div className="w-full bg-slate-100 rounded-full h-2 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full w-1/3 bg-violet-600 rounded-full"
                          style={{ animation: "indeterminate 1.5s ease-in-out infinite" }}
                        />
                      </div>
                    </div>
                  )}
                  {step === 6 && progress.total > 0 && (
                    <div className="w-full max-w-md space-y-2">
                      <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                        <span>进度 {Math.round((progress.current / progress.total) * 100)}%</span>
                        <span>{progress.current} / {progress.total} 批</span>
                      </div>
                      <div className="bg-slate-100 rounded-full h-2 dark:bg-slate-800 overflow-hidden">
                        <div 
                          className="bg-violet-600 h-full transition-all duration-300 ease-out" 
                          style={{ width: `${(progress.current / progress.total) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={handleCancel}
                    className="text-sm text-slate-400 hover:text-slate-600 mt-4 transition-colors dark:hover:text-slate-300"
                  >
                    取消操作
                  </button>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-amber-100 text-amber-600 rounded-xl dark:bg-amber-900/30 dark:text-amber-400">
                      <MessageCircleQuestion className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold dark:text-white">请确认以下事项</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        AI 检查后发现了需要您确认的问题，请填写回答以便更准确地处理。
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                    {questions.map((q, i) => (
                      <div key={q.id} className="rounded-xl border border-slate-200 p-5 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                        <div className="flex gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-800 dark:bg-amber-700 dark:text-amber-100">
                            {i + 1}
                          </span>
                          <div className="flex-1">
                            <p className="font-medium text-slate-800 dark:text-white mb-1">{q.question}</p>
                            {q.context && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 bg-white p-2 rounded border border-slate-100 dark:bg-slate-900 dark:border-slate-700">
                                上下文：{q.context}
                              </p>
                            )}
                            <input
                              type="text"
                              value={answers[q.id] ?? ""}
                              onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                              placeholder="请输入您的回答（如：确认、删除、归入餐饮等）"
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                      <AlertCircle className="h-5 w-5 shrink-0" />
                      <span className="text-sm">{error}</span>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => setStep(1)}
                      className="rounded-xl px-6 py-2.5 font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      返回修改
                    </button>
                    <button
                      onClick={() => {
                        if (summary) setStep(5);
                        else runSummary();
                      }}
                      className="rounded-xl border border-slate-300 px-6 py-2.5 font-medium hover:bg-slate-50 dark:border-slate-600 dark:text-white dark:hover:bg-slate-800"
                    >
                      跳过问题
                    </button>
                    <button
                      onClick={handleConfirmQuestions}
                      className="rounded-xl bg-violet-600 px-6 py-2.5 font-medium text-white hover:bg-violet-700 flex items-center gap-2"
                    >
                      确认并继续 <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              )}

              {step === 5 && summary && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-8">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">数据概览</h2>
                    <p className="text-slate-500 dark:text-slate-400">在全量清洗前，请确认数据是否符合预期</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 dark:bg-slate-800/50 dark:border-slate-700">
                      <div className="text-sm text-slate-500 mb-1 dark:text-slate-400">预估记录数</div>
                      <div className="text-2xl font-bold text-slate-800 dark:text-white">~{summary.estimatedCount} 条</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 dark:bg-slate-800/50 dark:border-slate-700">
                      <div className="text-sm text-slate-500 mb-1 dark:text-slate-400">日期范围</div>
                      <div className="text-lg font-bold text-slate-800 dark:text-white truncate" title={summary.dateRange}>{summary.dateRange}</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 dark:bg-slate-800/50 dark:border-slate-700">
                      <div className="text-sm text-slate-500 mb-1 dark:text-slate-400">预估总支出</div>
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {summary.totalExpense != null ? `¥${summary.totalExpense.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}` : "—"}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 dark:bg-slate-800/50 dark:border-slate-700">
                      <div className="text-sm text-slate-500 mb-1 dark:text-slate-400">预估总收入</div>
                      <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {summary.totalIncome != null ? `¥${summary.totalIncome.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}` : "—"}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 dark:bg-slate-800/50 dark:border-slate-700">
                      <div className="text-sm text-slate-500 mb-1 dark:text-slate-400">数据来源</div>
                      <div className="text-lg font-bold text-slate-800 dark:text-white">{summary.sources.join("、") || "未知"}</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 dark:bg-slate-800/50 dark:border-slate-700">
                      <div className="text-sm text-slate-500 mb-1 dark:text-slate-400">预估噪声/退款</div>
                      <div className="text-2xl font-bold text-slate-800 dark:text-white">{summary.noiseCount} 条</div>
                    </div>
                  </div>

                  {(summary.top10Expense?.length || summary.top10Income?.length) ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {summary.top10Expense && summary.top10Expense.length > 0 && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 dark:bg-slate-800/50 dark:border-slate-700">
                          <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">支出 Top 10</div>
                          <ul className="space-y-1.5 text-sm">
                            {summary.top10Expense.map((item, i) => (
                              <li key={i} className="flex justify-between">
                                <span className="truncate max-w-[140px]" title={item.description}>{item.description}</span>
                                <span className="text-red-600 dark:text-red-400 font-medium shrink-0">¥{Number.isFinite(item.amount) ? item.amount.toLocaleString("zh-CN") : "—"}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {summary.top10Income && summary.top10Income.length > 0 && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 dark:bg-slate-800/50 dark:border-slate-700">
                          <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">收入 Top 10</div>
                          <ul className="space-y-1.5 text-sm">
                            {summary.top10Income.map((item, i) => (
                              <li key={i} className="flex justify-between">
                                <span className="truncate max-w-[140px]" title={item.description}>{item.description}</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium shrink-0">¥{Number.isFinite(item.amount) ? item.amount.toLocaleString("zh-CN") : "—"}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {summary.categoryBreakdown && summary.categoryBreakdown.length > 0 && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 dark:bg-slate-800/50 dark:border-slate-700">
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">分类分布</div>
                      <div className="flex flex-wrap gap-2">
                        {summary.categoryBreakdown.map((c, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs dark:bg-slate-900 dark:border-slate-600">
                            <span className="text-slate-700 dark:text-slate-300">{c.category}</span>
                            <span className="text-slate-500">({Number.isFinite(c.count) ? c.count : 0}笔 ¥{Number.isFinite(c.amount) ? c.amount.toLocaleString("zh-CN") : "—"})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {summary.recordGuidance && (
                    <div className="p-4 rounded-xl border border-violet-200 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-900/20">
                      <div className="text-sm font-semibold text-violet-800 dark:text-violet-300 mb-2">记录建议</div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">{summary.recordGuidance}</p>
                    </div>
                  )}

                  <div className={`p-5 rounded-xl border ${
                    summary.qualityRating === "可用" ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800" :
                    summary.qualityRating === "部分可用" ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800" :
                    "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold text-slate-800 dark:text-white">AI 质量评级：</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        summary.qualityRating === "可用" ? "bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-100" :
                        summary.qualityRating === "部分可用" ? "bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-100" :
                        "bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-100"
                      }`}>{summary.qualityRating}</span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{summary.summaryText}</p>
                  </div>

                  <div className="p-5 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        补充清洗要求
                        <span className="text-xs font-normal text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">选填</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                      如果你在上面概览中发现了不符合预期的地方（例如某些记录应该属于特定分类），可以在这里补充说明，AI 将在全量清洗时严格遵循。
                    </p>
                    <textarea
                      value={globalInstruction}
                      onChange={(e) => setGlobalInstruction(e.target.value)}
                      placeholder="例如：所有“美团打车”都分类为“差旅旅游”；所有“转账”如果大于 1000 元，标记为“不计收支”..."
                      className="w-full h-24 rounded-lg border border-slate-300 p-3 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white resize-none"
                    />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                      <AlertCircle className="h-5 w-5 shrink-0" />
                      <span className="text-sm">{error}</span>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => setStep(1)}
                      className="rounded-xl px-6 py-2.5 font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      取消导入
                    </button>
                    <button
                      onClick={runProcessing}
                      className="rounded-xl bg-violet-600 px-8 py-2.5 font-medium text-white hover:bg-violet-700 flex items-center gap-2"
                    >
                      确认并全量清洗 <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              )}

              {step === 7 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-8">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-xl font-bold dark:text-white">清洗完成预览</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        共成功解析并去重 {records.length} 条记录
                        {records.length === 0 && (
                          <span className="block mt-2 text-amber-600 dark:text-amber-400">
                            未解析到有效记录，请检查原始数据格式或返回重试
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 max-h-[50vh]">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300 sticky top-0 z-10">
                        <tr>
                          <th className="p-3 font-medium">时间</th>
                          <th className="p-3 font-medium">分类</th>
                          <th className="p-3 font-medium">类型</th>
                          <th className="p-3 font-medium text-right">金额</th>
                          <th className="p-3 font-medium">交易对方</th>
                          <th className="p-3 font-medium">说明</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y border-t border-slate-200 dark:divide-slate-700 dark:border-slate-700 dark:text-slate-300">
                        {records.slice(0, 50).map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="p-3 whitespace-nowrap">{r.dateStr}</td>
                            <td className="p-3 whitespace-nowrap">
                              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
                                {r.category}
                              </span>
                            </td>
                            <td className="p-3 whitespace-nowrap">
                              <span
                                className={`rounded-md px-2 py-1 text-xs ${
                                  r.type === "expense"
                                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                }`}
                              >
                                {r.type === "expense" ? "支出" : "收入"}
                              </span>
                            </td>
                            <td className="p-3 text-right font-medium whitespace-nowrap">
                              ¥{Number.isFinite(r.amount) ? r.amount.toFixed(2) : "—"}
                            </td>
                            <td className="p-3 truncate max-w-[120px]" title={r.counterparty}>{r.counterparty}</td>
                            <td className="p-3 truncate max-w-[180px]" title={r.description}>{r.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {records.length > 50 && (
                      <div className="p-3 text-center text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                        仅显示前 50 条记录
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                      <AlertCircle className="h-5 w-5 shrink-0" />
                      <span className="text-sm">{error}</span>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => setStep(1)}
                      className="rounded-xl px-6 py-2.5 font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      放弃并重试
                    </button>
                    <button
                      onClick={handleImportConfirm}
                      className="rounded-xl bg-violet-600 px-8 py-2.5 font-medium text-white hover:bg-violet-700"
                    >
                      确认导入系统
                    </button>
                  </div>
                </div>
              )}

              {step === 8 && (
                <div className="flex flex-col items-center justify-center py-16 space-y-5 animate-in zoom-in-95">
                  <div className="h-20 w-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center dark:bg-emerald-900/30">
                    <CheckCircle2 className="h-10 w-10" />
                  </div>
                  <h3 className="text-2xl font-bold dark:text-white">导入成功！</h3>
                  <p className="text-slate-500 dark:text-slate-400">
                    已成功将 {records.length} 条清洗后的账单记录存入系统
                  </p>
                  <button
                    onClick={onClose}
                    className="mt-6 rounded-xl bg-slate-800 px-10 py-3 font-medium text-white hover:bg-slate-900 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                  >
                    完成并查看
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
