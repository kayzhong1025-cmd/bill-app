import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";
import ChartDataLabels from "chartjs-plugin-datalabels";

ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);

const COLOR_PALETTE = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#6366f1", "#f97316",
  "#14b8a6", "#a855f7", "#f43f5e", "#22c55e", "#d946ef",
];

interface CategoryPieProps {
  categories: [string, number][];
  isDark: boolean;
  title: string;
  selectedCategory?: string | null;
  onCategoryClick?: (category: string | null) => void;
}

export default function CategoryPie({ categories, isDark, title, selectedCategory, onCategoryClick }: CategoryPieProps) {
  const labels = categories.map(([name]) => name);
  const values = categories.map(([, amount]) => amount);
  const colors = labels.map((_, i) => COLOR_PALETTE[i % COLOR_PALETTE.length]);

  const data: ChartData<"doughnut"> = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: colors,
        borderWidth: labels.map(l => l === selectedCategory ? 4 : 2),
        borderColor: labels.map(l => l === selectedCategory ? (isDark ? "#ffffff" : "#0f172a") : (isDark ? "#0f172a" : "#ffffff")),
        hoverOffset: 4,
      },
    ],
  };

  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "60%",
    onClick: (_, elements, chart) => {
      if (!onCategoryClick) return;
      if (elements.length > 0) {
        const index = elements[0].index;
        const category = chart.data.labels![index] as string;
        if (category === selectedCategory) {
          onCategoryClick(null);
        } else {
          onCategoryClick(category);
        }
      } else {
        onCategoryClick(null);
      }
    },
    plugins: {
      legend: {
        position: "right",
        labels: {
          boxWidth: 12,
          font: { size: 11 },
          color: isDark ? "#e2e8f0" : "#475569",
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const val = ctx.parsed as number;
            const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
            const pct = ((val / total) * 100).toFixed(1);
            return ` ¥${val.toLocaleString("zh-CN")} (${pct}%)`;
          },
        },
      },
      datalabels: {
        color: "#ffffff",
        font: { weight: "bold", size: 10 },
        textAlign: "center",
        formatter: (value: number, context) => {
          const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
          const percentage = ((value / total) * 100).toFixed(1);
          if (Number(percentage) <= 3) return "";

          const rank = context.dataIndex;
          const label = context.chart.data.labels?.[rank];

          if (rank < 3) {
            return `${label}\n${percentage}%`;
          }
          return `${percentage}%`;
        },
      },
    },
  };

  if (categories.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">暂无数据</div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-4 text-base font-semibold">{title}</h3>
      <div className="relative h-60">
        <Doughnut data={data} options={options} />
      </div>
    </div>
  );
}
