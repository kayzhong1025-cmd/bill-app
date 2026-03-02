import { useState, useEffect } from "react";
import { Sparkles, Loader2, AlertCircle, RefreshCw, Lightbulb, Target, Trash2, Edit2, Plus, Check, X } from "lucide-react";
import type { BillRecord } from "../types/bill";
import { buildInsightContext } from "../lib/insight";

const GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_API_KEY = "";
const INSIGHT_CACHE_KEY = "bill_insight_cache";
const CACHE_VERSION = 4;

function getCacheKey(year: string, month: string) {
  return `${year}_${month}`;
}

export interface InsightItem {
  id: string;
  discovery: string;
  suggestion: string;
  isEditing?: boolean;
}

function safeRandomUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function loadCachedInsights(year: string, month: string): InsightItem[] | null {
  try {
    const raw = localStorage.getItem(INSIGHT_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as Record<string, unknown>;
    // Allow reading v3 cache to migrate to v4
    if (cache._v !== CACHE_VERSION && cache._v !== 3) return null;
    const key = getCacheKey(year, month);
    const val = cache[key];
    if (Array.isArray(val) && val.length > 0) {
      const first = val[0];
      if (typeof first === "object" && first !== null && "discovery" in first && "suggestion" in first) {
        const items = val as any[];
        if (items.some((i) => i.discovery?.startsWith("["))) return null;
        return items.map(i => ({
          id: i.id || safeRandomUUID(),
          discovery: i.discovery,
          suggestion: i.suggestion
        }));
      }
      return (val as string[]).map((s) => {
        const parsed = parseDiscoverySuggestion(s);
        return { ...parsed, id: safeRandomUUID() };
      });
    }
    return null;
  } catch {
    return null;
  }
}

function parseDiscoverySuggestion(text: string): { discovery: string; suggestion: string } {
  const cleaned = text.replace(/^[0-9]+[\.\、]\s*/, "").trim();
  const suggestIdx = cleaned.search(/建议[：:]/);
  if (suggestIdx > 0) {
    const discovery = cleaned.slice(0, suggestIdx).replace(/^发现[：:]\s*/, "").trim();
    const suggestion = cleaned.slice(suggestIdx).replace(/建议[：:]\s*/, "").trim();
    return { discovery: discovery || cleaned, suggestion: suggestion || "" };
  }
  return { discovery: cleaned.replace(/^发现[：:]\s*/, "").trim(), suggestion: "" };
}

function tryParseJsonArray(text: string): InsightItem[] | null {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return null;
  try {
    let jsonStr = jsonMatch[0];
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, "$1");
    const parsed = JSON.parse(jsonStr) as Array<{ 发现?: string; 建议?: string; discovery?: string; suggestion?: string }>;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const items = parsed
      .slice(0, 5)
      .map((item) => ({
        id: safeRandomUUID(),
        discovery: String(item?.["发现"] ?? item?.discovery ?? "").trim(),
        suggestion: String(item?.["建议"] ?? item?.suggestion ?? "").trim(),
      }))
      .filter((item) => item.discovery.length >= 5 && !item.discovery.startsWith("["));
    return items.length >= 2 ? items : null;
  } catch {
    return null;
  }
}

function sanitizeInsights(items: InsightItem[]): InsightItem[] {
  return items.filter(
    (i) =>
      i.discovery.length >= 5 &&
      !i.discovery.startsWith("[") &&
      !i.discovery.startsWith("{")
  );
}

function saveCachedInsights(year: string, month: string, insights: InsightItem[]) {
  try {
    const raw = localStorage.getItem(INSIGHT_CACHE_KEY);
    const cache: Record<string, unknown> = raw ? JSON.parse(raw) : {};
    cache._v = CACHE_VERSION;
    cache[getCacheKey(year, month)] = insights.map(i => ({ id: i.id, discovery: i.discovery, suggestion: i.suggestion }));
    localStorage.setItem(INSIGHT_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

interface InsightTabProps {
  records: BillRecord[];
  selectedYear: string;
  selectedMonth: string;
}

export default function InsightTab({ records, selectedYear, selectedMonth }: InsightTabProps) {
  const [insights, setInsights] = useState<InsightItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSingle, setLoadingSingle] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = loadCachedInsights(selectedYear, selectedMonth);
    setInsights(cached);
  }, [selectedYear, selectedMonth]);

  const getPeriodLabel = () => {
    return selectedYear === "all" && selectedMonth === "all"
      ? "全部时间"
      : selectedYear === "all"
        ? `${selectedMonth}月`
        : selectedMonth === "all"
          ? `${selectedYear}年`
          : `${selectedYear}年${selectedMonth}月`;
  };

  const handleAnalyze = async (isRegenerate = false) => {
    const key = import.meta.env.VITE_GEMINI_API_KEY || DEFAULT_API_KEY;
    if (!key) {
      setError("请配置 VITE_GEMINI_API_KEY 环境变量");
      return;
    }

    setLoading(true);
    setError(null);
    if (isRegenerate) setInsights(null);

    const context = buildInsightContext(records, selectedYear, selectedMonth);
    const periodLabel = getPeriodLabel();
    
    // 获取当前真实时间，防止 AI 产生“要求补齐未来数据”的幻觉
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const prompt = `你是一位专业的个人财务分析师。请基于以下账单数据，用中文给出【最重要的 5 条】财务洞见，按优先级从高到低排序。每条包含：发现（问题/现状分析）+ 建议（可执行改进方案）。

【重要背景信息】
当前真实时间是：${currentYear}年${currentMonth}月。
如果用户提供的数据只到当前月份，这是完全正常的，请绝对不要在建议中提出“补充缺失月份数据”、“数据不完整”等荒谬要求。

【严格要求】
1. 全部使用中文，建议要具体可操作
2. 基于数据真实数字，金额表述准确

【输出格式】必须输出合法的 JSON 数组，恰好 5 个元素，不要其他文字：
[
  {"发现": "第一条的发现内容", "建议": "第一条的改进建议"},
  {"发现": "第二条的发现内容", "建议": "第二条的改进建议"},
  {"发现": "第三条的发现内容", "建议": "第三条的改进建议"},
  {"发现": "第四条的发现内容", "建议": "第四条的改进建议"},
  {"发现": "第五条的发现内容", "建议": "第五条的改进建议"}
]

数据范围：${periodLabel}

${context}`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5 },
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(errBody || `API 错误: ${res.status}`);
      }

      const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

      let result: InsightItem[] = [];

      const directParse = tryParseJsonArray(text);
      if (directParse) {
        result = directParse;
      } else {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            let jsonStr = jsonMatch[0];
            jsonStr = jsonStr.replace(/,(\s*[}\]])/g, "$1");
            const parsed = JSON.parse(jsonStr) as Array<{ 发现?: string; 建议?: string; discovery?: string; suggestion?: string }>;
            if (Array.isArray(parsed) && parsed.length > 0) {
              result = parsed
                .slice(0, 5)
                .map((item) => ({
                  id: safeRandomUUID(),
                  discovery: String(item?.["发现"] ?? item?.discovery ?? "").trim(),
                  suggestion: String(item?.["建议"] ?? item?.suggestion ?? "").trim(),
                }))
                .filter((item) => item.discovery.length >= 5 && !item.discovery.startsWith("["));
            }
          } catch {
            const objRegex = /"发现"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"建议"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
            const manual: InsightItem[] = [];
            let m;
            while ((m = objRegex.exec(text)) !== null && manual.length < 5) {
              manual.push({
                id: safeRandomUUID(),
                discovery: m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n"),
                suggestion: m[2].replace(/\\"/g, '"').replace(/\\n/g, "\n"),
              });
            }
            if (manual.length >= 2) result = manual;
          }
        }
      }

      if (result.length < 2) {
        const blocks = text.split(/\n\s*\n/).map((s: string) => s.trim()).filter(Boolean);
        let candidates: string[] = [];
        for (const block of blocks) {
          const lines = block.split("\n").map((s: string) => s.trim()).filter(Boolean);
          const numbered = lines.filter((s: string) => /^[0-9]+[\.\、]\s*/.test(s));
          if (numbered.length > 0) {
            candidates.push(...numbered);
          } else if (block.length > 30) {
            candidates.push(block);
          }
        }
        if (candidates.length < 5) {
          const splitByNumber = text.split(/\s*(?=[0-9]+[\.\、]\s)/);
          const extra = splitByNumber
            .map((s: string) => s.trim())
            .filter((s: string) => /^[0-9]+[\.\、]\s*/.test(s) && s.length > 25);
          if (extra.length > candidates.length) {
            candidates = extra;
          }
        }
        const rawItems = candidates
          .slice(0, 5)
          .map((s: string) => s.replace(/^[0-9]+[\.\、]\s*/, "").replace(/^[•\-]\s*/, "").trim())
          .filter((s: string) => s.length >= 15 && !s.trim().startsWith("["));
        result = rawItems.length >= 1
          ? rawItems.map((s: string) => ({ ...parseDiscoverySuggestion(s), id: safeRandomUUID() }))
          : [];
        if (result.length === 0 && text && !text.trim().startsWith("[")) {
          result = [{ ...parseDiscoverySuggestion(text), id: safeRandomUUID() }];
        }
      }

      result = sanitizeInsights(result);
      if (result.length === 0 && text) {
        const fromRaw = tryParseJsonArray(text);
        if (fromRaw) result = fromRaw;
      }

      if (result.length >= 1) {
        setInsights(result);
        saveCachedInsights(selectedYear, selectedMonth, result);
      } else {
        setInsights(null);
        if (text) {
          console.error("[Insight Parse Error] text:", text);
          setError("AI 返回格式异常，无法解析洞见。已在控制台输出日志，请尝试点击「重新生成」。");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败，请检查网络和 API Key");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSingle = async (targetId?: string) => {
    const key = import.meta.env.VITE_GEMINI_API_KEY || DEFAULT_API_KEY;
    if (!key) {
      alert("请配置 VITE_GEMINI_API_KEY 环境变量");
      return;
    }

    const isAppending = !targetId;
    const loadingKey = isAppending ? "new" : targetId;
    setLoadingSingle((prev) => ({ ...prev, [loadingKey]: true }));

    try {
      const context = buildInsightContext(records, selectedYear, selectedMonth);
      const periodLabel = getPeriodLabel();
      
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      const currentInsights = insights || [];
      const existingText = currentInsights.length > 0
        ? `\n\n已经存在的洞见有（请勿重复）：\n${currentInsights.map(i => `- ${i.discovery}`).join('\n')}`
        : "";

      const prompt = `你是一位专业的个人财务分析师。请基于以下账单数据，给出一个【全新】的财务洞见（包含发现和建议）。${existingText}

【重要背景信息】
当前真实时间是：${currentYear}年${currentMonth}月。
如果用户提供的数据只到当前月份，这是完全正常的，请绝对不要在建议中提出“补充缺失月份数据”、“数据不完整”等荒谬要求。

【严格要求】
1. 全部使用中文，建议要具体可操作
2. 基于数据真实数字，金额表述准确

【输出格式】必须输出合法的 JSON 对象，不要其他文字：
{
  "发现": "发现内容",
  "建议": "改进建议"
}

数据范围：${periodLabel}

${context}`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 }, // Slightly higher temp for more variety
        }),
      });

      if (!res.ok) {
        throw new Error(`API 错误: ${res.status}`);
      }

      const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
      }

      if (!parsed || (!parsed["发现"] && !parsed.discovery)) {
        throw new Error("AI 返回格式异常，无法解析");
      }

      const newItem: InsightItem = {
        id: targetId || safeRandomUUID(),
        discovery: String(parsed["发现"] || parsed.discovery || "").trim(),
        suggestion: String(parsed["建议"] || parsed.suggestion || "").trim(),
      };

      setInsights((prev) => {
        const current = prev || [];
        let next: InsightItem[];
        if (isAppending) {
          next = [...current, newItem];
        } else {
          next = current.map(item => item.id === targetId ? newItem : item);
        }
        saveCachedInsights(selectedYear, selectedMonth, next);
        return next;
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "生成单条洞见失败");
    } finally {
      setLoadingSingle((prev) => ({ ...prev, [loadingKey]: false }));
    }
  };

  const handleDelete = (id: string) => {
    setInsights((prev) => {
      if (!prev) return prev;
      const next = prev.filter(item => item.id !== id);
      saveCachedInsights(selectedYear, selectedMonth, next);
      return next;
    });
  };

  const handleSaveEdit = (id: string, discovery: string, suggestion: string) => {
    setInsights((prev) => {
      if (!prev) return prev;
      const next = prev.map(item => item.id === id ? { ...item, discovery, suggestion, isEditing: false } : item);
      saveCachedInsights(selectedYear, selectedMonth, next);
      return next;
    });
  };

  const handleAddManual = () => {
    const newItem: InsightItem = {
      id: safeRandomUUID(),
      discovery: "",
      suggestion: "",
      isEditing: true
    };
    setInsights((prev) => [...(prev || []), newItem]);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-amber-50/30 p-6 shadow-sm dark:border-slate-700/80 dark:from-slate-900 dark:to-amber-950/20">
        <h2 className="mb-4 flex items-center gap-3 text-lg font-bold">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md">
            <Sparkles size={20} />
          </span>
          AI 财务洞见
        </h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          使用 Gemini 分析您的账单数据，生成财务洞见及可改进方案。您可以针对单条洞见进行重新生成、编辑或删除。
        </p>

        <div className="flex flex-wrap gap-2">
          {!insights || insights.length === 0 ? (
            <button
              type="button"
              onClick={() => handleAnalyze(false)}
              disabled={loading || records.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 font-medium text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  获取 5 条洞见
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleAnalyze(true)}
              disabled={loading || records.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  全部重新生成
                </>
              ) : (
                <>
                  <RefreshCw size={18} />
                  全部重新生成
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
          <AlertCircle size={20} className="shrink-0 text-red-500" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {insights && insights.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-300/50 to-transparent dark:via-amber-500/30" />
            <h3 className="shrink-0 text-base font-semibold text-slate-600 dark:text-slate-300">
              财务洞见
            </h3>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-300/50 to-transparent dark:via-amber-500/30" />
          </div>
          
          <div className="space-y-5">
            {insights.map((item, i) => (
              <InsightCard
                key={item.id}
                item={item}
                index={i}
                isRegenerating={!!loadingSingle[item.id]}
                onSave={handleSaveEdit}
                onDelete={handleDelete}
                onRegenerate={handleGenerateSingle}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button
              onClick={() => handleGenerateSingle()}
              disabled={loadingSingle["new"]}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-5 py-2.5 text-sm font-medium text-amber-700 transition hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40 disabled:opacity-50"
            >
              {loadingSingle["new"] ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              AI 追加一条
            </button>
            <button
              onClick={handleAddManual}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <Plus size={16} />
              手动新增
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InsightCard({
  item,
  index,
  isRegenerating,
  onSave,
  onDelete,
  onRegenerate,
}: {
  item: InsightItem;
  index: number;
  isRegenerating: boolean;
  onSave: (id: string, discovery: string, suggestion: string) => void;
  onDelete: (id: string) => void;
  onRegenerate: (id: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(item.isEditing || false);
  const [discovery, setDiscovery] = useState(item.discovery);
  const [suggestion, setSuggestion] = useState(item.suggestion);

  if (isEditing) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-blue-200 bg-blue-50/30 p-5 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/20">
        <div className="mb-4 space-y-4">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Lightbulb size={14} className="text-amber-500" />
              发现
            </label>
            <textarea
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              rows={3}
              placeholder="输入财务发现..."
              value={discovery}
              onChange={(e) => setDiscovery(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Target size={14} className="text-emerald-500" />
              建议
            </label>
            <textarea
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              rows={3}
              placeholder="输入改进建议..."
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              if (!item.discovery && !item.suggestion) onDelete(item.id);
              else {
                setDiscovery(item.discovery);
                setSuggestion(item.suggestion);
                setIsEditing(false);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X size={16} />
            取消
          </button>
          <button
            onClick={() => {
              onSave(item.id, discovery, suggestion);
              setIsEditing(false);
            }}
            disabled={!discovery.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Check size={16} />
            保存
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:shadow-md hover:border-amber-200/60 dark:border-slate-700/80 dark:bg-slate-800/40 dark:hover:border-amber-500/30">
      <div
        className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 dark:from-amber-500 dark:via-amber-600 dark:to-amber-700"
        style={{ opacity: Math.max(0.3, 0.95 - index * 0.1) }}
      />
      
      {/* 行内操作按钮 (Hover显示) */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
        <button
          onClick={() => onRegenerate(item.id)}
          disabled={isRegenerating}
          title="重新生成此条"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/80 text-slate-400 shadow-sm backdrop-blur transition hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50 dark:bg-slate-800/80 dark:hover:bg-amber-900/30 dark:hover:text-amber-400"
        >
          <RefreshCw size={14} className={isRegenerating ? "animate-spin" : ""} />
        </button>
        <button
          onClick={() => setIsEditing(true)}
          title="编辑"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/80 text-slate-400 shadow-sm backdrop-blur transition hover:bg-blue-50 hover:text-blue-600 dark:bg-slate-800/80 dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
        >
          <Edit2 size={14} />
        </button>
        <button
          onClick={() => onDelete(item.id)}
          title="删除"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/80 text-slate-400 shadow-sm backdrop-blur transition hover:bg-red-50 hover:text-red-600 dark:bg-slate-800/80 dark:hover:bg-red-900/30 dark:hover:text-red-400"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className={`grid gap-0 sm:grid-cols-1 lg:grid-cols-2 lg:gap-0 ${isRegenerating ? 'opacity-50' : ''}`}>
        <div className="flex gap-4 p-5 lg:p-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 text-base font-bold text-amber-700 shadow-inner dark:from-amber-900/50 dark:to-amber-800/30 dark:text-amber-300">
            {index + 1}
          </span>
          <div className="flex-1 min-w-0 pr-10 sm:pr-0">
            <div className="mb-2 flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Lightbulb size={14} className="shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider">发现</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {item.discovery}
            </p>
          </div>
        </div>
        <div className="border-t border-slate-100 bg-slate-50/50 p-5 lg:border-t-0 lg:border-l lg:bg-emerald-50/30 dark:border-slate-700 dark:bg-slate-800/30 dark:lg:bg-emerald-950/20 lg:p-6">
          <div className="mb-2 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <Target size={14} className="shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wider">建议</span>
          </div>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {item.suggestion || "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
