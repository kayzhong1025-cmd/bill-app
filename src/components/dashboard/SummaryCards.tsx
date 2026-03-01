import type { DashboardSummary, ComparisonData } from "../../types/bill";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

function formatCurrency(value: number) {
  return value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface SummaryCardsProps {
  summary: DashboardSummary;
  comparison?: ComparisonData;
}

export default function SummaryCards({ summary, comparison }: SummaryCardsProps) {
  const { totalIncome, totalExpense, balance } = summary;
  const isNegativeBalance = balance < 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card 
        label="总收入" 
        value={`¥${formatCurrency(totalIncome)}`} 
        color="border-t-green-500" 
        textColor="text-green-500"
        mom={comparison?.momIncome}
        yoy={comparison?.yoyIncome}
        reverseColor={true}
      />
      <Card 
        label="总支出" 
        value={`¥${formatCurrency(totalExpense)}`} 
        color="border-t-red-500" 
        textColor="text-red-500"
        mom={comparison?.momExpense}
        yoy={comparison?.yoyExpense}
      />
      <Card
        label="结余"
        value={`${isNegativeBalance ? "-" : ""}¥${formatCurrency(Math.abs(balance))}`}
        color={isNegativeBalance ? "border-t-orange-500" : "border-t-violet-500"}
        textColor={isNegativeBalance ? "text-orange-500" : "text-violet-500"}
      />
    </div>
  );
}

interface CardProps {
  label: string;
  value: string;
  color: string;
  textColor: string;
  mom?: number | null;
  yoy?: number | null;
  reverseColor?: boolean;
}

function Card({ label, value, color, textColor, mom, yoy, reverseColor }: CardProps) {
  return (
    <div
      className={`relative rounded-2xl border-t-4 border border-slate-200 bg-gradient-to-br from-white to-violet-50/30 p-5 shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-violet-200/60 dark:border-slate-800 dark:from-slate-900 dark:to-violet-900/5 dark:hover:border-violet-500/30 ${color}`}
    >
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-2xl font-bold ${textColor}`}>{value}</p>
      
      {(mom !== undefined && mom !== null || yoy !== undefined && yoy !== null) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {mom !== undefined && mom !== null && (
            <div className="flex items-center gap-1">
              <span className="text-slate-400">环比</span>
              <TrendBadge value={mom} reverseColor={reverseColor} />
            </div>
          )}
          {yoy !== undefined && yoy !== null && (
            <div className="flex items-center gap-1">
              <span className="text-slate-400">同比</span>
              <TrendBadge value={yoy} reverseColor={reverseColor} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TrendBadge({ value, reverseColor = false }: { value: number; reverseColor?: boolean }) {
  const isUp = value > 0;
  const isZero = value === 0;
  
  if (isZero) {
    return <span className="text-slate-400 font-medium">持平</span>;
  }
  
  let colorClass = isUp ? "text-red-500" : "text-green-500";
  if (reverseColor) {
    colorClass = isUp ? "text-green-500" : "text-red-500";
  }
  
  return (
    <span className={`flex items-center font-medium ${colorClass}`}>
      {isUp ? <ArrowUpRight className="mr-0.5 h-3 w-3" /> : <ArrowDownRight className="mr-0.5 h-3 w-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}
