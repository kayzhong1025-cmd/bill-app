import { useMemo } from "react";
import type { BillRecord } from "../../types/bill";

interface HeatmapProps {
  records: BillRecord[];
  selectedYear: string;
  selectedMonth: string;
  onDayClick?: (dateStr: string) => void;
}

export default function Heatmap({ records, selectedYear, selectedMonth, onDayClick }: HeatmapProps) {
  // When year is "all", use the latest year from records for display
  const displayYear = useMemo(() => {
    if (selectedYear !== "all") return selectedYear;
    const years = [...new Set(records.map((r) => r.year))].sort().reverse();
    return years[0] ?? "";
  }, [records, selectedYear]);

  const { maxAmount, dayMap } = useMemo(() => {
    if (!displayYear) return { maxAmount: 0, dayMap: new Map<string, number>() };
    
    const map = new Map<string, number>();
    let max = 0;
    
    records.forEach((r) => {
      if (r.year === displayYear && (selectedMonth === "all" || r.month === selectedMonth) && r.type === "expense") {
        const current = (map.get(r.dateStr) || 0) + r.amount;
        map.set(r.dateStr, current);
        if (current > max) max = current;
      }
    });
    
    return { maxAmount: max, dayMap: map };
  }, [records, displayYear, selectedMonth]);

  const calendarData = useMemo(() => {
    if (!displayYear) return [];
    
    const yearNum = parseInt(displayYear);
    const monthsToRender = selectedMonth === "all" 
      ? Array.from({ length: 12 }, (_, i) => i + 1)
      : [parseInt(selectedMonth)];

    return monthsToRender.map(monthNum => {
      const startDate = new Date(yearNum, monthNum - 1, 1);
      const endDate = new Date(yearNum, monthNum, 0);
      
      const startDay = startDate.getDay(); // 0 is Sunday
      const firstCalendarDay = new Date(startDate);
      firstCalendarDay.setDate(startDate.getDate() - startDay);
      
      const weeksArr: { dateStr: string; amount: number; isCurrentMonth: boolean; dayNum: number }[][] = [];
      let currentWeek: { dateStr: string; amount: number; isCurrentMonth: boolean; dayNum: number }[] = [];
      
      let currentDate = new Date(firstCalendarDay);
      
      while (currentDate <= endDate || currentWeek.length > 0) {
        if (currentWeek.length === 7) {
          weeksArr.push(currentWeek);
          currentWeek = [];
          if (currentDate > endDate) break;
        }
        
        const y = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, "0");
        const d = String(currentDate.getDate()).padStart(2, "0");
        const dateStr = `${y}-${m}-${d}`;
        
        currentWeek.push({
          dateStr,
          amount: dayMap.get(dateStr) || 0,
          isCurrentMonth: currentDate.getMonth() === monthNum - 1,
          dayNum: currentDate.getDate()
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      return { monthNum, weeks: weeksArr };
    });
  }, [displayYear, selectedMonth, dayMap]);

  const getColor = (amount: number) => {
    if (amount === 0) return "bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500";
    
    // 4 levels of intensity
    const ratio = amount / (maxAmount || 1);
    if (ratio < 0.1) return "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-200 font-medium";
    if (ratio < 0.3) return "bg-emerald-300 dark:bg-emerald-700/80 text-emerald-900 dark:text-emerald-100 font-semibold";
    if (ratio < 0.6) return "bg-emerald-500 dark:bg-emerald-500 text-white font-bold";
    return "bg-emerald-600 dark:bg-emerald-400 text-white font-bold";
  };

  if (!displayYear) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-6 text-lg font-bold">消费日历热力图</h2>
      
      <div className={`grid gap-6 ${selectedMonth === "all" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1 md:grid-cols-2 lg:max-w-2xl"}`}>
        {calendarData.map((month) => (
          <div key={month.monthNum} className="flex flex-col">
            <h3 className="mb-2 text-center text-sm font-semibold text-slate-600 dark:text-slate-300">
              {month.monthNum}月
            </h3>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400 mb-1">
              <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
            </div>
            <div className="flex flex-col gap-1">
              {month.weeks.map((week, i) => (
                <div key={i} className="grid grid-cols-7 gap-1">
                  {week.map((day, j) => (
                    <div
                      key={j}
                      title={day.isCurrentMonth ? `${day.dateStr}: ¥${day.amount.toLocaleString("zh-CN")}` : ""}
                      onClick={() => day.isCurrentMonth && onDayClick && onDayClick(day.dateStr)}
                      className={`relative flex aspect-square items-center justify-center rounded-md text-xs transition-colors ${
                        !day.isCurrentMonth 
                          ? "opacity-0" 
                          : `${getColor(day.amount)} hover:ring-2 hover:ring-blue-400 hover:ring-offset-1 dark:hover:ring-offset-slate-900 cursor-pointer`
                      }`}
                    >
                      {day.isCurrentMonth && day.dayNum}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6 flex items-center justify-end gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>少</span>
        <div className="h-4 w-4 rounded-sm bg-slate-50 dark:bg-slate-800/50" />
        <div className="h-4 w-4 rounded-sm bg-emerald-100 dark:bg-emerald-900/60" />
        <div className="h-4 w-4 rounded-sm bg-emerald-300 dark:bg-emerald-700/80" />
        <div className="h-4 w-4 rounded-sm bg-emerald-500 dark:bg-emerald-500" />
        <div className="h-4 w-4 rounded-sm bg-emerald-600 dark:bg-emerald-400" />
        <span>多</span>
      </div>
    </div>
  );
}
