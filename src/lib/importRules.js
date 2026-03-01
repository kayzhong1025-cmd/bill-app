"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadImportRules = loadImportRules;
exports.saveImportRules = saveImportRules;
exports.buildCleaningPrompt = buildCleaningPrompt;
var STORAGE_KEY = "bill_import_rules";
var DEFAULT_CORE_RULES = [
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
var DEFAULT_PERSONAL_RULES = [
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
function loadImportRules() {
    var _a, _b;
    try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            var parsed = JSON.parse(raw);
            return {
                coreRules: (_a = parsed.coreRules) !== null && _a !== void 0 ? _a : DEFAULT_CORE_RULES,
                personalRules: (_b = parsed.personalRules) !== null && _b !== void 0 ? _b : DEFAULT_PERSONAL_RULES,
            };
        }
    }
    catch (_c) {
        /* ignore */
    }
    return {
        coreRules: DEFAULT_CORE_RULES,
        personalRules: DEFAULT_PERSONAL_RULES,
    };
}
function saveImportRules(rules) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
    }
    catch (_a) {
        /* ignore */
    }
}
function buildCleaningPrompt(rules) {
    var enabledCore = rules.coreRules.filter(function (r) { return r.enabled; });
    var enabledPersonal = rules.personalRules.filter(function (r) { return r.enabled; });
    var prompt = "\u4F60\u662F\u4E00\u4F4D\u9876\u7EA7\u7684\u201C\u4E2A\u4EBA\u8D22\u52A1\u5BA1\u8BA1\u5E08\u201D\u548C\u201C\u6570\u636E\u67B6\u6784\u5E08\u201D\u3002\u4F60\u7684\u4EFB\u52A1\u662F\u5C06\u591A\u6765\u6E90\u7684\u539F\u59CB\u6D88\u8D39\u8D26\u5355\uFF08\u5FAE\u4FE1\u3001\u652F\u4ED8\u5B9D\u3001\u624B\u52A8\u8D26\u5355\uFF09\u8F6C\u5316\u4E3A\u4E00\u4EFD\u9AD8\u7CBE\u5EA6\u3001\u53EF\u8FFD\u6EAF\u3001\u53BB\u91CD\u540E\u7684\u8D22\u52A1\u5BF9\u8D26\u5355\u3002\n\n\u7B2C\u4E00\u6B65\uFF1A\u6807\u51C6 Schema \u5B9A\u4E49\n\u6240\u6709\u5904\u7406\u540E\u7684\u6570\u636E\u5FC5\u987B\u4E25\u683C\u5BF9\u9F50\u5230\u4EE5\u4E0B\u8868\u5934\uFF1A\n\u4EA4\u6613\u65F6\u95F4,\u7CBE\u7EC6\u5206\u7C7B,\u6536\u652F,\u91D1\u989D,\u91D1\u989D_\u51C0\u503C,\u4EA4\u6613\u5BF9\u65B9,\u5546\u54C1\u8BF4\u660E,\u6765\u6E90,\u5FC5\u8981\u6027\u6253\u6807,\u5907\u6CE8\n\n\u7B2C\u4E8C\u6B65\uFF1A\u6838\u5FC3\u5BA1\u8BA1\u903B\u8F91\uFF08\u5FC5\u987B\u4E25\u683C\u6267\u884C\uFF09\n";
    if (enabledCore.length > 0) {
        prompt += enabledCore.map(function (r) { return "".concat(r.label, "\uFF1A").concat(r.description); }).join("\n");
    }
    else {
        prompt += "（无核心规则）";
    }
    prompt += "\n\n\u7B2C\u4E09\u6B65\uFF1A\u4E13\u9879\u4E1A\u52A1\u89C4\u5219\uFF08\u4E2A\u6027\u5316\u6CE8\u5165\uFF09\n";
    if (enabledPersonal.length > 0) {
        prompt += enabledPersonal
            .map(function (r) { return "".concat(r.category, "\uFF1A\u8BC6\u522B\u5305\u542B ").concat(r.keywords.map(function (k) { return "\"".concat(k, "\""); }).join("、"), " \u7B49\u5173\u952E\u8BCD\u3002"); })
            .join("\n");
    }
    else {
        prompt += "（无个性化规则）";
    }
    prompt += "\n\n\u7B2C\u56DB\u6B65\uFF1A\u6536\u652F\u5217\u53D6\u503C\n\u6536\u652F\u5217\u5FC5\u987B\u4E3A\u4EE5\u4E0B\u4E09\u8005\u4E4B\u4E00\uFF1A\u652F\u51FA\u3001\u6536\u5165\u3001\u4E0D\u8BA1\u6536\u652F\u3002\n- \u652F\u51FA\uFF1A\u8D44\u91D1\u6D41\u51FA\uFF08\u6D88\u8D39\u3001\u8F6C\u8D26\u7B49\uFF09\n- \u6536\u5165\uFF1A\u8D44\u91D1\u6D41\u5165\uFF08\u5DE5\u8D44\u3001\u56DE\u6B3E\u3001\u9000\u6B3E\u7B49\uFF09\n- \u4E0D\u8BA1\u6536\u652F\uFF1A\u652F\u4ED8\u5B9D\u6536\u94B1\u7801\u6536\u6B3E\u3001\u7ECF\u8425\u7801\u4EA4\u6613\u3001\u90E8\u5206\u56E2\u8D2D/\u5927\u4F17\u70B9\u8BC4\u8BA2\u5355\u7B49\uFF0C\u91D1\u989D\u4E3A\u6B63\u6570\u4F46\u8BB0\u4E3A\u4E0D\u8BA1\u6536\u652F\uFF0C\u91D1\u989D_\u51C0\u503C\u540C\u91D1\u989D\n\n\u7B2C\u4E94\u6B65\uFF1A\u5DE5\u4F5C\u6D41\u8981\u6C42\n\u76F4\u63A5\u8F93\u51FA\u7EAF\u6587\u672C CSV\uFF08\u7B2C\u4E00\u884C\u4E3A\u8868\u5934\uFF09\uFF0C\n\u8868\u5934\u56FA\u5B9A\u4E3A\uFF1A\u4EA4\u6613\u65F6\u95F4,\u7CBE\u7EC6\u5206\u7C7B,\u6536\u652F,\u91D1\u989D,\u91D1\u989D_\u51C0\u503C,\u4EA4\u6613\u5BF9\u65B9,\u5546\u54C1\u8BF4\u660E,\u6765\u6E90,\u5FC5\u8981\u6027\u6253\u6807,\u5907\u6CE8\n\u4E0D\u8981\u8F93\u51FA\u4EFB\u4F55\u89E3\u91CA\u6587\u5B57\uFF0C\u4E0D\u8981\u4F7F\u7528\u4EE3\u7801\u5757\uFF0C\u4EC5\u8F93\u51FA CSV \u5185\u5BB9\u3002";
    return prompt;
}
