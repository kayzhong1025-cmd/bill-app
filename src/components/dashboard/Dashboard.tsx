import { useMemo, useState, useEffect } from "react";
import { getCategoriesForView, getSummary, getTopRecords, getTrendData, getComparisonData } from "../../lib/analytics";
import type { BillRecord, DashboardViewType } from "../../types/bill";
import SummaryCards from "./SummaryCards";
import CategoryPie from "./CategoryPie";
import TrendLine from "./TrendLine";
import TopRecordsTable from "./TopRecordsTable";

interface DashboardProps {
  records: BillRecord[];
  rawData: BillRecord[];
  viewType: DashboardViewType;
  onViewTypeChange: (type: DashboardViewType) => void;
  isDark: boolean;
  year: string;
  month: string;
  onEditRecord: (record: BillRecord) => void;
  onDeleteRecord: (record: BillRecord) => void;
}

export default function Dashboard({ records, rawData, viewType, onViewTypeChange, isDark, year, month, onEditRecord, onDeleteRecord }: DashboardProps) {
  const [selectedPieCategory, setSelectedPieCategory] = useState<string | null>(null);

  // Reset pie selection when view type or filters change
  useEffect(() => {
    setSelectedPieCategory(null);
  }, [viewType, year, month]);

  const summary = useMemo(() => {
    return getSummary(records);
  }, [records]);
  const comparison = useMemo(() => {
    return getComparisonData(rawData, year, month);
  }, [rawData, year, month]);
  const categories = useMemo(() => {
    return getCategoriesForView(records, viewType);
  }, [records, viewType]);
  const trend = useMemo(() => {
    return getTrendData(records, viewType, year, month);
  }, [records, viewType, year, month]);
  
  const topRecords = useMemo(() => {
    let filtered = records;
    if (selectedPieCategory) {
      filtered = filtered.filter(r => r.category === selectedPieCategory);
    }
    return getTopRecords(filtered, viewType);
  }, [records, viewType, selectedPieCategory]);

  const isIncome = viewType === "income";

  return (
    <div className="space-y-5 animate-fade-in">
      <SummaryCards summary={summary} comparison={comparison} />

      {/* View type toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isIncome ? "收入" : "支出"}数据概览</h2>
        <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <ToggleBtn label="支出分析" active={!isIncome} onClick={() => onViewTypeChange("expense")} />
          <ToggleBtn label="收入分析" active={isIncome} onClick={() => onViewTypeChange("income")} />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <CategoryPie
            categories={categories}
            isDark={isDark}
            title={isIncome ? "收入分类占比" : "支出分类占比"}
            selectedCategory={selectedPieCategory}
            onCategoryClick={setSelectedPieCategory}
          />
        </div>
        <div className="lg:col-span-2">
          <TrendLine
            labels={trend.labels}
            values={trend.values}
            isDark={isDark}
            title={isIncome ? "收入趋势" : "消费趋势"}
          />
        </div>
      </div>

      {/* Top 10 */}
      <TopRecordsTable
        records={topRecords}
        title={
          selectedPieCategory
            ? `【${selectedPieCategory}】${isIncome ? "收入" : "消费"}最高的 10 笔记录`
            : `${isIncome ? "收入" : "消费"}最高的 10 笔记录`
        }
        onEditRecord={onEditRecord}
        onDeleteRecord={onDeleteRecord}
      />
    </div>
  );
}

function ToggleBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-violet-600 text-white"
          : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      }`}
    >
      {label}
    </button>
  );
}
