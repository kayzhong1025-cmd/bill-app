"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRawInput = validateRawInput;
exports.validateApiKey = validateApiKey;
exports.validateGeminiResponse = validateGeminiResponse;
exports.sanitizeDataSummary = sanitizeDataSummary;
exports.sanitizeAuditQuestions = sanitizeAuditQuestions;
exports.validateGeminiCsvOutput = validateGeminiCsvOutput;
exports.isValidBillRecord = isValidBillRecord;
exports.validateParsedCsv = validateParsedCsv;
var csv_1 = require("./csv");
/** 校验原始输入文本 */
function validateRawInput(rawText) {
    var trimmed = rawText.trim();
    if (!trimmed) {
        return { valid: false, error: "请输入或上传账单数据" };
    }
    var lines = trimmed.split("\n").filter(function (l) { return l.trim().length > 0; });
    if (lines.length < 3) {
        return { valid: false, error: "数据过少，至少需要几行有效内容（如表头 + 数据行）" };
    }
    // 检查是否像账单数据（含常见关键词）
    var text = trimmed.toLowerCase();
    var hasBillLikeContent = /交易|金额|支出|收入|微信|支付宝|转账|收款|付款/.test(text) ||
        /^\d{4}[-/年]\d/.test(trimmed) ||
        lines.some(function (l) { return /[\d.,]+\s*元?/.test(l); });
    if (!hasBillLikeContent) {
        return { valid: false, error: "未识别到账单格式，请上传微信/支付宝导出的 CSV 或 Excel" };
    }
    return { valid: true };
}
/** 校验 API Key */
function validateApiKey(apiKey) {
    if (!apiKey || apiKey.trim().length < 10) {
        return { valid: false, error: "请先配置有效的 Gemini API Key" };
    }
    return { valid: true };
}
/** 校验 Gemini API 响应是否有效 */
function validateGeminiResponse(data) {
    if (!data || typeof data !== "object") {
        return { valid: false, error: "API 返回格式异常" };
    }
    var obj = data;
    var promptFeedback = obj.promptFeedback;
    var candidates = obj.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) {
        if (promptFeedback === null || promptFeedback === void 0 ? void 0 : promptFeedback.blockReason) {
            return { valid: false, error: "内容被安全策略过滤，请检查输入数据" };
        }
        return { valid: false, error: "AI 未返回有效内容，请重试" };
    }
    var candidate = candidates[0];
    var finishReason = candidate && typeof candidate === "object" ? candidate.finishReason : undefined;
    if (finishReason === "SAFETY" || finishReason === "RECITATION") {
        return { valid: false, error: "内容被安全策略过滤，请检查输入数据" };
    }
    var content = candidate && typeof candidate === "object" ? candidate.content : undefined;
    var parts = content && typeof content === "object" ? content.parts : undefined;
    var firstPart = Array.isArray(parts) ? parts[0] : undefined;
    var text = firstPart && typeof firstPart === "object" ? firstPart.text : undefined;
    if (text == null || (typeof text === "string" && text.trim().length === 0)) {
        return { valid: false, error: "AI 未返回有效内容，请重试" };
    }
    return { valid: true, text: typeof text === "string" ? text : String(text) };
}
/** 校验并清洗 DataSummary */
function sanitizeDataSummary(parsed) {
    var safeNum = function (v, def) {
        return typeof v === "number" && Number.isFinite(v) ? v : def;
    };
    var safeStr = function (v, def) {
        return typeof v === "string" && v.trim() ? v.trim() : def;
    };
    var safeArr = function (v, guard) {
        return Array.isArray(v) ? v.map(guard).filter(Boolean) : [];
    };
    var sanitizeTopItem = function (x) {
        if (!x || typeof x !== "object")
            return null;
        var o = x;
        var amount = safeNum(o.amount, 0);
        var description = safeStr(o.description, "—");
        if (amount <= 0 || !description)
            return null;
        return {
            amount: amount,
            description: description,
            date: typeof o.date === "string" ? o.date : undefined,
            type: o.type === "income" || o.type === "expense" ? o.type : undefined,
        };
    };
    var sanitizeCategoryItem = function (x) {
        if (!x || typeof x !== "object")
            return null;
        var o = x;
        var category = safeStr(o.category, "");
        var count = safeNum(o.count, 0);
        var amount = safeNum(o.amount, 0);
        if (!category)
            return null;
        return { category: category, count: count, amount: amount };
    };
    return {
        estimatedCount: Math.max(0, Math.min(safeNum(parsed.estimatedCount, 0), 100000)),
        dateRange: safeStr(parsed.dateRange, "未知"),
        sources: safeArr(parsed.sources, function (x) { return (typeof x === "string" ? x : null); }).filter(Boolean),
        noiseCount: Math.max(0, safeNum(parsed.noiseCount, 0)),
        qualityRating: ["可用", "部分可用", "建议不导入"].includes(safeStr(parsed.qualityRating, ""))
            ? safeStr(parsed.qualityRating, "")
            : "部分可用",
        summaryText: safeStr(parsed.summaryText, "无总结"),
        totalExpense: typeof parsed.totalExpense === "number" && Number.isFinite(parsed.totalExpense)
            ? parsed.totalExpense
            : undefined,
        totalIncome: typeof parsed.totalIncome === "number" && Number.isFinite(parsed.totalIncome)
            ? parsed.totalIncome
            : undefined,
        top10Expense: safeArr(parsed.top10Expense, sanitizeTopItem).slice(0, 10),
        top10Income: safeArr(parsed.top10Income, sanitizeTopItem).slice(0, 10),
        categoryBreakdown: safeArr(parsed.categoryBreakdown, sanitizeCategoryItem),
        recordGuidance: typeof parsed.recordGuidance === "string" && parsed.recordGuidance.trim()
            ? parsed.recordGuidance.trim()
            : undefined,
    };
}
/** 校验并清洗 AuditQuestion */
function sanitizeAuditQuestions(questions) {
    if (!Array.isArray(questions) || questions.length === 0)
        return [];
    return questions
        .map(function (q, i) {
        if (!q || typeof q !== "object")
            return null;
        var o = q;
        var question = typeof o.question === "string" ? o.question.trim() : "";
        if (!question)
            return null;
        return {
            id: typeof o.id === "string" ? o.id : "q".concat(i + 1),
            question: question,
            context: typeof o.context === "string" ? o.context : undefined,
        };
    })
        .filter(Boolean);
}
/** 校验 Gemini 清洗输出的 CSV 是否可解析 */
function validateGeminiCsvOutput(csvText) {
    var trimmed = csvText.trim();
    if (!trimmed) {
        return { valid: false, error: "本批次 AI 未返回有效内容，可能被截断" };
    }
    var lines = trimmed.split("\n").filter(function (l) { return l.trim(); });
    if (lines.length < 2) {
        return { valid: false, error: "本批次返回数据过少，可能不完整" };
    }
    return { valid: true };
}
/** 校验单条 BillRecord 是否合法 */
function isValidBillRecord(r) {
    if (!r || typeof r !== "object")
        return false;
    var o = r;
    return (typeof o.hash === "string" &&
        o.hash.length > 0 &&
        (o.type === "income" || o.type === "expense") &&
        typeof o.dateStr === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(o.dateStr) &&
        typeof o.amount === "number" &&
        Number.isFinite(o.amount) &&
        o.amount > 0);
}
/** 校验解析后的 CSV 是否有有效表头 */
function validateParsedCsv(parsed) {
    var _a, _b, _c;
    var rows = (_a = parsed.data) !== null && _a !== void 0 ? _a : [];
    var headers = (_c = (_b = parsed.meta) === null || _b === void 0 ? void 0 : _b.fields) !== null && _c !== void 0 ? _c : (rows[0] ? Object.keys(rows[0]) : []);
    var _d = (0, csv_1.validateCsvHeaders)(headers), valid = _d.valid, missing = _d.missing;
    if (!valid) {
        return {
            valid: false,
            error: "\u7F3A\u5C11\u5FC5\u8981\u5217\uFF1A".concat(missing.join("、"), "\uFF0CAI \u8F93\u51FA\u683C\u5F0F\u53EF\u80FD\u5F02\u5E38"),
        };
    }
    return { valid: true };
}
