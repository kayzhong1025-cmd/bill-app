import { useState, useMemo, useEffect } from "react";
import { ChevronUp, ChevronDown, GripVertical, ChevronLeft, ChevronRight, Trash2, Edit3, Sparkles } from "lucide-react";
import type { BillRecord } from "../types/bill";

interface SearchTabProps {
  records: BillRecord[];
  onEditRecord: (record: BillRecord) => void;
  onDeleteRecord: (record: BillRecord) => void;
  onBatchEdit?: (records: BillRecord[]) => void;
  onAICorrect?: (records: BillRecord[]) => void;
}

type SortField = "date" | "amount" | "category";
type SortOrder = "asc" | "desc";

const DEFAULT_COL_WIDTHS = { checkbox: 44, date: 100, type: 70, category: 110, counterparty: 130, description: 180, amount: 100, actions: 56 };
const PAGE_SIZE = 100;

function SortableTh({
  label,
  field,
  currentField,
  sortOrder,
  onSort,
  align = "left",
  rounded,
  width,
  onResize,
}: {
  label: string;
  field: SortField;
  currentField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  align?: "left" | "right";
  rounded?: "left" | "right";
  width?: number;
  onResize?: (newWidth: number) => void;
}) {
  const isActive = currentField === field;
  return (
    <th
      className={`p-3 font-semibold ${align === "right" ? "text-right" : ""} ${isActive ? "text-blue-600 dark:text-blue-400" : ""} ${rounded === "left" ? "rounded-tl-lg" : ""} ${rounded === "right" ? "rounded-tr-lg" : ""}`}
      style={width !== undefined ? { width, minWidth: width } : undefined}
    >
      <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
        <button
          type="button"
          onClick={() => onSort(field)}
          className={`inline-flex items-center gap-1 rounded transition hover:bg-slate-200/50 dark:hover:bg-slate-700/50 ${align === "right" ? "" : "flex-1"}`}
          title={isActive ? `当前${sortOrder === "desc" ? "降序" : "升序"}，点击切换` : "点击排序"}
        >
          {label}
          {isActive ? (
            sortOrder === "desc" ? <ChevronDown size={14} /> : <ChevronUp size={14} />
          ) : (
            <ChevronDown size={12} className="opacity-40" />
          )}
        </button>
        {onResize && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              const startX = e.clientX;
              const startW = width ?? 100;
              const onMove = (e2: MouseEvent) => {
                onResize(Math.max(60, startW + (e2.clientX - startX)));
              };
              const onUp = () => {
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onUp);
              };
              document.addEventListener("mousemove", onMove);
              document.addEventListener("mouseup", onUp);
            }}
            className="cursor-col-resize rounded p-0.5 text-slate-300 hover:bg-slate-200 hover:text-slate-500 dark:text-slate-600 dark:hover:bg-slate-700"
            title="拖拽调整列宽"
          >
            <GripVertical size={12} />
          </button>
        )}
      </div>
    </th>
  );
}

export default function SearchTab({ records, onEditRecord, onDeleteRecord, onBatchEdit, onAICorrect }: SearchTabProps) {
  const [keyword, setKeyword] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "income" | "transfer">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [colWidths, setColWidths] = useState(DEFAULT_COL_WIDTHS);
  const [page, setPage] = useState(1);
  const [selectedHashes, setSelectedHashes] = useState<Set<string>>(new Set());

  const categoryOptions = useMemo(() => {
    const cats = [...new Set(records.map((r) => r.category))].sort();
    return cats;
  }, [records]);

  const results = useMemo(() => {
    let res = records;

    if (typeFilter !== "all") {
      res = res.filter((r) => r.type === typeFilter);
    }

    if (categoryFilter !== "all") {
      res = res.filter((r) => r.category === categoryFilter);
    }

    if (minAmount !== "") {
      const min = parseFloat(minAmount);
      if (!isNaN(min)) res = res.filter((r) => r.amount >= min);
    }

    if (maxAmount !== "") {
      const max = parseFloat(maxAmount);
      if (!isNaN(max)) res = res.filter((r) => r.amount <= max);
    }

    if (keyword.trim() !== "") {
      const lowerKw = keyword.toLowerCase();
      res = res.filter(
        (r) =>
          r.description.toLowerCase().includes(lowerKw) ||
          r.category.toLowerCase().includes(lowerKw) ||
          r.counterparty.toLowerCase().includes(lowerKw) ||
          r.necessity.toLowerCase().includes(lowerKw)
      );
    }

    const sorted = [...res].sort((a, b) => {
      if (sortField === "date") {
        const cmp = a.dateStr.localeCompare(b.dateStr);
        return sortOrder === "desc" ? -cmp : cmp;
      }
      if (sortField === "category") {
        const cmp = a.category.localeCompare(b.category);
        return sortOrder === "desc" ? -cmp : cmp;
      }
      const cmp = a.amount - b.amount;
      return sortOrder === "desc" ? -cmp : cmp;
    });
    return sorted;
  }, [records, keyword, minAmount, maxAmount, typeFilter, categoryFilter, sortField, sortOrder]);

  const totalSum = results.reduce((sum, r) => sum + r.amount, 0);
  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const paginatedResults = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return results.slice(start, start + PAGE_SIZE);
  }, [results, page]);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [keyword, minAmount, maxAmount, typeFilter, categoryFilter]);

  const selectedRecords = useMemo(
    () => results.filter((r) => selectedHashes.has(r.hash)),
    [results, selectedHashes]
  );

  const toggleSelect = (hash: string) => {
    setSelectedHashes((prev) => {
      const next = new Set(prev);
      if (next.has(hash)) next.delete(hash);
      else next.add(hash);
      return next;
    });
  };

  const toggleSelectPage = () => {
    const allSelected = paginatedResults.every((r) => selectedHashes.has(r.hash));
    setSelectedHashes((prev) => {
      const next = new Set(prev);
      paginatedResults.forEach((r) => {
        if (allSelected) next.delete(r.hash);
        else next.add(r.hash);
      });
      return next;
    });
  };

  const handleSort = (field: SortField) => {
    setPage(1);
    if (sortField === field) {
      setSortOrder((o) => (o === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-12">
          <div className="md:col-span-4">
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              关键词 (说明/商户/分类/标签)
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="输入搜索词..."
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800"
            />
          </div>
          <div className="md:col-span-4">
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">金额范围 (¥)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="最小"
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800"
              />
              <span className="text-slate-400">-</span>
              <input
                type="number"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="最大"
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800"
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">类型</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as "all" | "expense" | "income" | "transfer")}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="all">全部收支</option>
              <option value="expense">仅支出</option>
              <option value="income">仅收入</option>
              <option value="transfer">仅不计收支</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">分类</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="all">全部分类</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-bold">搜索结果</h2>
          <div className="flex items-center gap-3">
            {selectedRecords.length > 0 && (
              <>
                {onBatchEdit && (
                  <button
                    type="button"
                    onClick={() => onBatchEdit(selectedRecords)}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-500"
                  >
                    <Edit3 size={16} />
                    批量修改 ({selectedRecords.length})
                  </button>
                )}
                {onAICorrect && (
                  <button
                    type="button"
                    onClick={() => onAICorrect(selectedRecords)}
                    className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-violet-500"
                  >
                    <Sparkles size={16} />
                    AI 智能修正 ({selectedRecords.length})
                  </button>
                )}
              </>
            )}
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
              共 <span className="text-blue-500">{results.length}</span> 笔，总计:{" "}
              <span className="text-slate-900 dark:text-white">
                ¥{totalSum.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {results.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-slate-400">没有找到匹配的结果</div>
          ) : (
            <table className="w-full text-left text-sm" style={{ tableLayout: "fixed" }}>
      <colgroup>
        <col style={{ width: colWidths.checkbox }} />
        <col style={{ width: colWidths.date }} />
        <col style={{ width: colWidths.type }} />
        <col style={{ width: colWidths.category }} />
        <col style={{ width: colWidths.counterparty }} />
        <col style={{ width: colWidths.description }} />
        <col style={{ width: colWidths.amount }} />
        <col style={{ width: colWidths.actions }} />
      </colgroup>
              <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm dark:bg-slate-800">
                <tr className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="rounded-tl-lg p-3" style={{ width: colWidths.checkbox, minWidth: colWidths.checkbox }}>
                    <input
                      type="checkbox"
                      checked={paginatedResults.length > 0 && paginatedResults.every((r) => selectedHashes.has(r.hash))}
                      onChange={toggleSelectPage}
                      className="h-4 w-4 rounded border-slate-300"
                      title="本页全选/取消"
                    />
                  </th>
                  <SortableTh
                    label="日期"
                    field="date"
                    currentField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                    rounded="left"
                    width={colWidths.date}
                    onResize={(w) => setColWidths((p) => ({ ...p, date: w }))}
                  />
                  <th className="p-3 font-semibold" style={{ width: colWidths.type, minWidth: colWidths.type }}>
                    类型
                  </th>
                  <SortableTh
                    label="分类"
                    field="category"
                    currentField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                    width={colWidths.category}
                    onResize={(w) => setColWidths((p) => ({ ...p, category: w }))}
                  />
                  <th className="p-3 font-semibold" style={{ width: colWidths.counterparty, minWidth: colWidths.counterparty }}>
                    交易对方
                  </th>
                  <th className="p-3 font-semibold" style={{ width: colWidths.description, minWidth: colWidths.description }}>
                    商品说明
                  </th>
                  <SortableTh
                    label="金额 (¥)"
                    field="amount"
                    currentField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                    align="right"
                    width={colWidths.amount}
                    onResize={(w) => setColWidths((p) => ({ ...p, amount: w }))}
                  />
                  <th className="rounded-tr-lg p-3 font-semibold" style={{ width: colWidths.actions, minWidth: colWidths.actions }}>
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {paginatedResults.map((r) => {
                  const isExp = r.type === "expense";
                  const isTransfer = r.type === "transfer";
                  const color = isExp ? "text-slate-900 dark:text-slate-200" : isTransfer ? "text-slate-500 dark:text-slate-400" : "text-green-600 dark:text-green-400";
                  const typeBg = isExp
                    ? "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                    : isTransfer
                    ? "bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-300"
                    : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
                  return (
                    <tr
                      key={r.hash}
                      onClick={() => onEditRecord(r)}
                      className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedHashes.has(r.hash)}
                          onChange={() => toggleSelect(r.hash)}
                          className="h-4 w-4 rounded border-slate-300"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="truncate p-3 text-slate-500 dark:text-slate-400">{r.dateStr.split(" ")[0]}</td>
                      <td className="truncate p-3">
                        <span className={`rounded px-2 py-1 text-xs font-medium ${typeBg}`}>
                          {isExp ? "支出" : isTransfer ? "不计收支" : "收入"}
                        </span>
                      </td>
                      <td className="truncate p-3">{r.category}</td>
                      <td className="truncate p-3 text-slate-500 dark:text-slate-400" title={r.counterparty}>
                        {r.counterparty}
                      </td>
                      <td className="truncate p-3 text-slate-500 dark:text-slate-400" title={r.description}>
                        {r.description}
                      </td>
                      <td className={`truncate p-3 text-right font-medium ${color}`}>
                        {isExp ? "-" : isTransfer ? "" : "+"}¥{r.amount.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onDeleteRecord(r)}
                          className="rounded p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-red-500 dark:hover:bg-slate-700 dark:hover:text-red-400"
                          title="删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {results.length > 0 && totalPages > 1 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-4 dark:border-slate-700">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              第 {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, results.length)} 条 / 共 {results.length} 条
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <ChevronLeft size={16} className="inline" />
                上一页
              </button>
              <span className="px-2 text-sm text-slate-600 dark:text-slate-300">
                第 {page} / {totalPages} 页
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                下一页
                <ChevronRight size={16} className="inline" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
