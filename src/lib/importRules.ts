export interface CoreRule {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

export interface PersonalRule {
  id: string;
  category: string;
  keywords: string[];
  enabled: boolean;
}

export interface ImportRules {
  coreRules: CoreRule[];
  personalRules: PersonalRule[];
}

const STORAGE_KEY = "bill_import_rules";

const DEFAULT_CORE_RULES: CoreRule[] = [
  {
    id: "net_value",
    label: "净值优先原则",
    description: "创建金额_净值列。支出设为正数，收入设为负数。",
    enabled: true,
  },
  {
    id: "aa_offset",
    label: "AA 账单对冲",
    description: "识别交易对方包含“群收款”或特定好友名，以及备注中包含“AA/饭钱/回款”的收入。将此类收入的分类标记为对应的消费类目（如餐饮美食），通过负数抵消支出，计算真实个人成本。",
    enabled: true,
  },
  {
    id: "ssot_dedup",
    label: "SSOT 去重原则",
    description: "若电子流水（微信/支付宝）与手动账单（如鲨鱼记账）在同一天出现金额一致的记录，强制保留电子流水（因其包含原始商户名），删除手动记录。",
    enabled: true,
  },
  {
    id: "noise_filter",
    label: "噪声过滤",
    description: "自动剔除“交易关闭”、“已退款”、“解冻成功”等非真实资金流动记录。",
    enabled: true,
  },
];

const DEFAULT_PERSONAL_RULES: PersonalRule[] = [
  {
    id: "travel",
    category: "差旅旅游",
    keywords: ["机票", "酒店", "高铁", "打车"],
    enabled: true,
  },
  {
    id: "dining",
    category: "餐饮美食",
    keywords: ["外卖", "餐厅", "咖啡", "奶茶"],
    enabled: true,
  },
  {
    id: "housing",
    category: "住房物业",
    keywords: ["水费", "电费", "燃气", "物业费", "房租"],
    enabled: true,
  },
];

export function loadImportRules(): ImportRules {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ImportRules>;
      return {
        coreRules: parsed.coreRules ?? DEFAULT_CORE_RULES,
        personalRules: parsed.personalRules ?? DEFAULT_PERSONAL_RULES,
      };
    }
  } catch {
    /* ignore */
  }
  return {
    coreRules: DEFAULT_CORE_RULES,
    personalRules: DEFAULT_PERSONAL_RULES,
  };
}

export function saveImportRules(rules: ImportRules) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch {
    /* ignore */
  }
}

export function buildCleaningPrompt(rules: ImportRules): string {
  const enabledCore = rules.coreRules.filter((r) => r.enabled);
  const enabledPersonal = rules.personalRules.filter((r) => r.enabled);

  let prompt = `你是一位顶级的“个人财务审计师”和“数据架构师”。你的任务是将多来源的原始消费账单（微信、支付宝、手动账单）转化为一份高精度、可追溯、去重后的财务对账单。

第一步：标准 Schema 定义
所有处理后的数据必须严格对齐到以下表头：
交易时间,精细分类,收支,金额,金额_净值,交易对方,商品说明,来源,必要性打标,备注

第二步：核心审计逻辑（必须严格执行）
`;

  if (enabledCore.length > 0) {
    prompt += enabledCore.map((r) => `${r.label}：${r.description}`).join("\n");
  } else {
    prompt += "（无核心规则）";
  }

  prompt += `\n\n第三步：专项业务规则（个性化注入）\n`;

  if (enabledPersonal.length > 0) {
    prompt += enabledPersonal
      .map((r) => `${r.category}：识别包含 ${r.keywords.map(k => `"${k}"`).join("、")} 等关键词。`)
      .join("\n");
  } else {
    prompt += "（无个性化规则）";
  }

  prompt += `\n\n第四步：收支列取值
收支列必须为以下三者之一：支出、收入、不计收支。
- 支出：真实的资金流出（日常消费、购物、餐饮等）
- 收入：真实的资金流入（工资、兼职收入、红包等）
- 不计收支：内部资金流转（如理财买入/卖出、转出到银行卡、还信用卡、余额宝转入/转出）、支付宝收钱码收款等，金额为正数但记为不计收支，金额_净值同金额

第五步：工作流要求
直接输出纯文本 CSV（第一行为表头），
表头固定为：交易时间,精细分类,收支,金额,金额_净值,交易对方,商品说明,来源,必要性打标,备注
不要输出任何解释文字，不要使用代码块，仅输出 CSV 内容。`;

  return prompt;
}
