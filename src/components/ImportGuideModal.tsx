import { useState, useCallback } from "react";
import { Download, MessageSquareText, Copy, Check, X, BookOpen } from "lucide-react";

export const AI_PROMPT = `我有一份微信/支付宝账单文件，请帮我清洗并转换成标准化的 CSV 格式。

【必须严格按此表头输出】
交易时间,精细分类,收支,金额,金额_净值,交易对方,商品说明,来源,必要性打标,备注

【字段规则】
- 交易时间：保留原始格式，如 2026-02-17 10:13:53
- 精细分类（支出类）：餐饮美食 / 交通出行 / 日常购物 / 住房物业 / 娱乐消费 / 医疗健康 / 人情往来 / 其他支出
- 精细分类（收入类）：工资薪资 / 兼职收入 / 其他收入
- 收支：只填「收入」「支出」或「不计收支」（转账、充值等填「不计收支」）
- 金额：绝对值，正数，不含 ¥ 符号
- 金额_净值：支出填正数，收入填负数（如收入 5000 元填 -5000）
- 交易对方：原始交易对方名称
- 商品说明：商品名称或备注
- 来源：微信 或 支付宝
- 必要性打标：刚性支出 / 弹性支出 / 可选支出 / 不计收支
- 备注：留空即可

【过滤规则】跳过状态为「交易关闭」「已退款」「对方已退还」的记录

请只输出 CSV 内容，不要任何说明文字，不要代码块。`;

export function ImportGuideContent() {
  const [promptCopied, setPromptCopied] = useState(false);

  const handleCopyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(AI_PROMPT);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Step 1 */}
      <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
            1
          </div>
          <h3 className="font-bold text-slate-800 dark:text-slate-100">导出原始账单</h3>
        </div>
        <div className="flex-1 space-y-3 text-sm text-slate-600 dark:text-slate-400">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <p className="mb-1 font-medium text-slate-700 dark:text-slate-300">微信账单</p>
            <p className="leading-relaxed">微信 → 我 → 服务 → 钱包 → 账单 → 右上角「…」→ 账单下载</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <p className="mb-1 font-medium text-slate-700 dark:text-slate-300">支付宝账单</p>
            <p className="leading-relaxed">支付宝 → 首页「账单」→ 右上角「…」→ 开具交易流水证明</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
          <Download size={13} />
          下载后得到 .csv 或 .xlsx 文件
        </div>
      </div>

      {/* Step 2 */}
      <div className="flex flex-col rounded-2xl border border-violet-200 bg-white p-6 shadow-sm ring-1 ring-violet-100 dark:border-violet-800/50 dark:bg-slate-900 dark:ring-violet-900/30">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
            2
          </div>
          <h3 className="font-bold text-slate-800 dark:text-slate-100">用 AI 清洗数据</h3>
        </div>
        <div className="flex-1 space-y-3 text-sm text-slate-600 dark:text-slate-400">
          <p>打开你常用的 AI 助手（如 <a href="https://kimi.aliyun.com" target="_blank" rel="noopener noreferrer" className="font-medium text-violet-600 hover:underline dark:text-violet-400">Kimi</a>、<a href="https://tongyi.aliyun.com" target="_blank" rel="noopener noreferrer" className="font-medium text-violet-600 hover:underline dark:text-violet-400">通义千问</a>、<a href="https://chatgpt.com" target="_blank" rel="noopener noreferrer" className="font-medium text-violet-600 hover:underline dark:text-violet-400">ChatGPT</a> 等），上传你的账单文件，然后发送下面这段提示词：</p>
          <div className="relative rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <p className="line-clamp-3 font-mono text-xs leading-relaxed text-slate-500 dark:text-slate-500">
              我有一份微信/支付宝账单文件，请帮我清洗并转换成标准化的 CSV 格式…
            </p>
            <button
              type="button"
              onClick={handleCopyPrompt}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500"
            >
              {promptCopied ? <Check size={12} /> : <Copy size={12} />}
              {promptCopied ? "已复制" : "复制完整提示词"}
            </button>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
          <MessageSquareText size={13} />
          AI 会输出标准格式的 CSV 内容
        </div>
      </div>

      {/* Step 3 */}
      <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            3
          </div>
          <h3 className="font-bold text-slate-800 dark:text-slate-100">导入 CSV 并分析</h3>
        </div>
        <div className="flex-1 space-y-3 text-sm text-slate-600 dark:text-slate-400">
          <p>将 AI 生成的 CSV 内容保存为 <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs dark:bg-slate-800">.csv</code> 文件，然后点击右上角的「导入 CSV」按钮上传。</p>
        </div>
      </div>
    </div>
  );
}

export default function ImportGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-5xl max-h-[90vh] flex-col rounded-2xl bg-slate-50 shadow-xl dark:bg-slate-950">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 rounded-t-2xl">
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-white">
            <BookOpen size={24} className="text-violet-500" />
            导入数据指南
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <ImportGuideContent />
        </div>
      </div>
    </div>
  );
}
