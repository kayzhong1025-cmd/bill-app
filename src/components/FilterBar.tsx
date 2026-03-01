import { ChevronDown } from "lucide-react";

interface FilterBarProps {
  years: string[];
  categories: string[];
  selectedYear: string;
  selectedMonth: string;
  selectedCategory: string;
  onYearChange: (year: string) => void;
  onMonthChange: (month: string) => void;
  onCategoryChange: (category: string) => void;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

export default function FilterBar({
  years,
  categories,
  selectedYear,
  selectedMonth,
  selectedCategory,
  onYearChange,
  onMonthChange,
  onCategoryChange,
}: FilterBarProps) {
  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-12 shrink-0 text-sm font-medium text-slate-600 dark:text-slate-400">年份</span>
          <div className="flex flex-wrap gap-2">
            <FilterBtn label="全部" value="all" selected={selectedYear === "all"} onClick={() => onYearChange("all")} />
            {years.map((y) => (
              <FilterBtn key={y} label={`${y}年`} value={y} selected={selectedYear === y} onClick={() => onYearChange(y)} />
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-12 shrink-0 text-sm font-medium text-slate-600 dark:text-slate-400">月份</span>
          <div className="flex flex-wrap gap-2">
            <FilterBtn label="全部" value="all" selected={selectedMonth === "all"} onClick={() => onMonthChange("all")} />
            {MONTHS.map((m) => (
              <FilterBtn key={m} label={`${parseInt(m)}月`} value={m} selected={selectedMonth === m} onClick={() => onMonthChange(m)} />
            ))}
          </div>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <span className="w-12 shrink-0 text-sm font-medium text-slate-600 dark:text-slate-400">分类</span>
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="appearance-none rounded-full border border-slate-200 bg-slate-50 py-1.5 pl-4 pr-10 text-sm font-medium text-slate-700 shadow-sm outline-none transition hover:bg-slate-100 hover:border-slate-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:border-slate-600"
            >
              <option value="all">全部分类</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-slate-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterBtn({ label, value, selected, onClick }: { label: string; value: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      data-value={value}
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm font-medium transition ${
        selected
          ? "bg-violet-600 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      }`}
    >
      {label}
    </button>
  );
}
