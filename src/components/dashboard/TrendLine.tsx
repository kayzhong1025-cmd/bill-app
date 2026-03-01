import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Filler,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import annotationPlugin from "chartjs-plugin-annotation";
import ChartDataLabels from "chartjs-plugin-datalabels";

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Filler, annotationPlugin, ChartDataLabels);

interface TrendLineProps {
  labels: string[];
  values: number[];
  isDark: boolean;
  title: string;
}

export default function TrendLine({ labels, values, isDark, title }: TrendLineProps) {
  const lineColor = "#3b82f6";
  const textColor = isDark ? "#94a3b8" : "#64748b";
  const gridColor = isDark ? "#1e293b" : "#f1f5f9";

  const averageValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  const data: ChartData<"line"> = {
    labels,
    datasets: [
      {
        label: title,
        data: values,
        borderColor: lineColor,
        backgroundColor: "rgba(59,130,246,0.12)",
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: textColor, maxRotation: 45, font: { size: 10 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: gridColor },
        ticks: {
          color: textColor,
          callback: (val) => `¥${val}`,
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ¥${(ctx.parsed.y as number).toLocaleString("zh-CN")}`,
        },
      },
      datalabels: {
        align: "top",
        color: textColor,
        font: { size: 10, weight: "bold" },
        formatter: (value: number) => (value > 0 ? `¥${Math.round(value)}` : ""),
      },
      annotation: {
        annotations: {
          averageLine: {
            type: "line",
            yMin: averageValue,
            yMax: averageValue,
            borderColor: isDark ? "#ef4444" : "#f87171",
            borderWidth: 1,
            borderDash: [5, 5],
            label: {
              content: `平均: ¥${Math.round(averageValue)}`,
              display: true,
              position: "end",
              backgroundColor: isDark ? "rgba(239, 68, 68, 0.9)" : "rgba(248, 113, 113, 0.9)",
              color: "#ffffff",
              font: { size: 10 },
              padding: 4,
            },
          },
        },
      },
    },
  };

  if (labels.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">暂无数据</div>
    );
  }

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-4 text-base font-semibold">{title}</h3>
      <div className="relative min-h-60 flex-1">
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
