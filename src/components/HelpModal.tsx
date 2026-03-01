import { useState } from "react";
import { X, HelpCircle, BookOpen, Cpu } from "lucide-react";

type HelpTab = "usage" | "tech";

interface HelpModalProps {
  onClose: () => void;
}

export default function HelpModal({ onClose }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState<HelpTab>("usage");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-2xl max-h-[85vh] flex-col rounded-2xl bg-white shadow-xl dark:bg-slate-900">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800">
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-white">
            <HelpCircle size={24} />
            帮助
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex shrink-0 border-b border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setActiveTab("usage")}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition ${
              activeTab === "usage"
                ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            }`}
          >
            <BookOpen size={18} />
            使用说明
          </button>
          <button
            onClick={() => setActiveTab("tech")}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition ${
              activeTab === "tech"
                ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            }`}
          >
            <Cpu size={18} />
            技术实现
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-slate-600 dark:text-slate-300">
          {activeTab === "usage" && (
            <>
              <section>
                <h3 className="mb-2 font-semibold text-slate-800 dark:text-white">导入账单数据</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>首次使用请按引导页的三步操作：导出账单 → 用 AI 助手对话清洗 → 导入 CSV</li>
                  <li>导入 CSV：上传符合格式的账单文件，每条记录会关联到对应文档</li>
                  <li>手动记账：添加单笔记录，不关联文档</li>
                  <li>清空数据：删除所有账单和文档记录</li>
                </ul>
              </section>

              <section>
                <h3 className="mb-2 font-semibold text-slate-800 dark:text-white">数据看板</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>展示收支汇总、分类占比饼图、消费趋势折线图</li>
                  <li>可切换「支出分析」与「收入分析」</li>
                  <li>点击饼图分类可筛选 Top 10 排行榜</li>
                  <li>点击排行榜中任意记录的编辑/删除图标可修改或删除该条记录</li>
                </ul>
              </section>

              <section>
                <h3 className="mb-2 font-semibold text-slate-800 dark:text-white">趋势分析</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>现金流分析图：按月对比收入与支出</li>
                  <li>热力图：点击某天可查看当日收支明细</li>
                  <li>收支对比：选择两个月进行支出对比</li>
                  <li>日历明细弹窗中，点击行可编辑，点击删除图标可删除该笔记录</li>
                </ul>
              </section>

              <section>
                <h3 className="mb-2 font-semibold text-slate-800 dark:text-white">明细搜索</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>数据范围受顶部筛选栏的年/月选择影响</li>
                  <li>支持按关键词、金额范围、收支类型（收入/支出）、分类筛选</li>
                  <li>点击表头「日期」「分类」「金额」可排序，再次点击切换升序/降序</li>
                  <li>点击任意行可打开编辑弹窗修改，点击删除图标可单条删除</li>
                  <li>表头右侧拖拽图标可调整列宽</li>
                  <li>默认每页 100 条，支持分页浏览</li>
                </ul>
              </section>

              <section>
                <h3 className="mb-2 font-semibold text-slate-800 dark:text-white">AI 洞见</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>使用 Google Gemini 分析账单数据，生成 5 条财务洞见与可执行改进建议</li>
                  <li>支持按年份、按月份筛选分析范围</li>
                  <li>需配置 VITE_GEMINI_API_KEY 环境变量（填入 Google AI Studio 获取的 Key）</li>
                  <li>已生成的洞见会缓存到本地，仅在点击「重新生成」时再次调用 API</li>
                </ul>
              </section>

              <section>
                <h3 className="mb-2 font-semibold text-slate-800 dark:text-white">文档管理</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>展示所有已导入的 CSV 文档列表</li>
                  <li>「导出 CSV」：将该文档对应的账单数据导出为 CSV 文件</li>
                  <li>「删除数据」：删除该文档及其关联的所有账单记录</li>
                </ul>
              </section>
            </>
          )}

          {activeTab === "tech" && (
            <>
              <section>
                <h3 className="mb-2 font-semibold text-slate-800 dark:text-white">产品设计思路</h3>
                <div className="space-y-3 text-slate-600 dark:text-slate-300">
                  <p><strong>核心定位：</strong>数据分析与洞见工具。用户在外部（AI 助手对话）完成数据清洗，本系统专注于展示、分析和 AI 洞见。</p>
                  <p><strong>数据流：</strong>用户导出原始账单 → 在 AI 助手对话中清洗为标准 CSV → 导入本系统 → IndexedDB 持久化 → 按年/月/分类筛选 → 各 Tab 展示与分析</p>
                  <p><strong>AI 洞见：</strong>构建账单摘要上下文 → 调用 Gemini API → 解析 JSON 洞见 → 缓存到 localStorage</p>
                </div>
              </section>

              <section>
                <h3 className="mb-2 font-semibold text-slate-800 dark:text-white">技术栈与工具</h3>
                <ul className="space-y-2">
                  <li><strong>React 19 + TypeScript</strong> — UI 框架与类型安全</li>
                  <li><strong>Vite</strong> — 构建与热更新</li>
                  <li><strong>Tailwind CSS</strong> — 样式与主题（暗/亮色）</li>
                  <li><strong>LocalForage</strong> — IndexedDB 封装，持久化账单与文档元数据</li>
                  <li><strong>Chart.js + react-chartjs-2</strong> — 饼图、折线图、热力图</li>
                  <li><strong>PapaParse</strong> — CSV 解析，导入/导出</li>
                  <li><strong>@tanstack/react-virtual</strong> — 虚拟滚动，明细表格大列表性能优化</li>
                  <li><strong>Lucide React</strong> — 图标</li>
                  <li><strong>Google Gemini API</strong> — AI 洞见分析与智能纠错</li>
                </ul>
              </section>

              <section>
                <h3 className="mb-2 font-semibold text-slate-800 dark:text-white">各工具作用</h3>
                <ul className="space-y-2 list-inside list-disc">
                  <li><strong>LocalForage</strong>：替代 localStorage，支持大容量存储，账单数据存 IndexedDB</li>
                  <li><strong>PapaParse</strong>：解析 CSV 文本为 JSON，校验表头，配合 rowsToRecords 转为 BillRecord</li>
                  <li><strong>Chart.js</strong>：数据看板饼图、趋势折线、现金流柱状图、热力图</li>
                  <li><strong>react-virtual</strong>：明细搜索表格只渲染可见行，支持数千条记录流畅滚动</li>
                  <li><strong>Gemini</strong>：洞见 Tab 分析账单数据，生成财务建议；明细搜索页支持批量智能纠错</li>
                </ul>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
