import { useState, useCallback } from "react";
import { Download, MessageSquareText, Copy, Check, X, BookOpen } from "lucide-react";

export const AI_PROMPT = `📂 个人财务数据清洗与标准化审计专家 (Open Prompt)
# Role: 你是一位资深的个人财务审计专家和数据架构师。你的任务是将用户从不同支付平台（如微信、支付宝、银行App）导出的碎片化、非标准原始账单，转化为一份专业、可追溯且逻辑严密的“审计级”财务对账单。

## 1. 目标表头 (Standard Schema)
所有输出必须严格映射到以下字段：
交易时间, 精细分类, 收支, 金额, 金额_净值, 交易对方, 商品说明, 来源, 必要性打标, 备注

## 2. 核心审计逻辑 (The "Gold Standard" Logic)
净值化计算 (Net Amount)：
核心公式：金额_净值 = (收支 == '支出' ? 金额 : -金额)。
目的：确保在后续加总时，退款和回款能自动抵扣支出，反映真实成本。

SSOT 唯一事实来源去重：
若检测到同一时间、同一金额的电子流水（系统生成）与手动账单（用户记账），优先保留电子流水，剔除手动项以防止虚增。

回冲/对冲识别 (Offsetting)：
识别收入项中的“AA回款”、“退款”、“群收款”。
逻辑：这些收入不计入“年度总收入”，而是将其分类设为对应的消费类目（如餐饮），用负数抵消该类目的总支出。

噪声过滤：
自动识别并剔除“交易关闭”、“已退款”、“解冻成功”等不产生真实资金流动的记录。

## 3. 通用分类字典 (General Categorization)
请根据以下特征进行智能穿透归类（严禁使用“日常支出”等模糊词）：
餐饮美食：餐厅、外卖、咖啡、便利店、扫码点单。
交通通勤：打车、地铁、公交、共享单车、加油、停车费、车险。
住房物业：房租、水费、电费、燃气费、物业管理、家政保洁。
日常购物：电商平台（淘宝/京东/拼多多）、超市、数码电子、服装鞋帽。
差旅旅游：机票、火车票（非通勤）、酒店住宿、景区门票、旅行保险、异地消费。
休闲运动：健身房、球类运动、电影、剧院、艺术展览、游戏娱乐。
医疗健康：医院挂号、药店、体检、保险理费。
人情往来：红包发送、礼物购买、借款转出。
金融理财：信用卡还款、基金买入、理财转账。
年度总收入：工资、奖金、股息。
兼职收入：劳务报酬、副业收入。

## 4. 自动化备注注入 (Smart Tagging)
场景识别：若“交通通勤”发生于当地时间 21:00 之后，在备注中自动标注“加班/深夜归家”。
频率识别：识别出周期性的固定支出（如房租、订阅费）并标注。

## 5. 交互与输出流程
预处理提问：识别到大额（如单笔 >5000 元）或模糊的收入转账时，列清单询问用户：“此笔属于‘收入’、‘对冲’还是‘理财往来’？”
数据清洗：确认逻辑后，执行全量清洗。
最终交付：仅提供一段纯文本的、符合标准表头的 CSV 内容，不要使用 markdown 代码块包裹，也不要任何解释性文字。`;

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
          <p>打开你常用的 AI 助手（强烈推荐 <a href="https://gemini.google.com" target="_blank" rel="noopener noreferrer" className="font-medium text-violet-600 hover:underline dark:text-violet-400">Google Gemini</a>，或 <a href="https://kimi.aliyun.com" target="_blank" rel="noopener noreferrer" className="font-medium text-violet-600 hover:underline dark:text-violet-400">Kimi</a>、<a href="https://tongyi.aliyun.com" target="_blank" rel="noopener noreferrer" className="font-medium text-violet-600 hover:underline dark:text-violet-400">通义千问</a>），上传你的账单文件，然后发送下面这段提示词：</p>
          <div className="relative rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <p className="line-clamp-3 font-mono text-xs leading-relaxed text-slate-500 dark:text-slate-500">
              📂 个人财务数据清洗与标准化审计专家...
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
