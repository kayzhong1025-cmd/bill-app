"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ESTIMATED_SEC_PER_BATCH = void 0;
exports.generateDataSummary = generateDataSummary;
exports.auditForQuestions = auditForQuestions;
exports.splitRawText = splitRawText;
exports.callGeminiClean = callGeminiClean;
exports.processAIImport = processAIImport;
exports.estimateBatchCount = estimateBatchCount;
var csv_1 = require("./csv");
var papaparse_1 = __importDefault(require("papaparse"));
var importRules_1 = require("./importRules");
var aiImportValidation_1 = require("./aiImportValidation");
var aiImportErrorReporter_1 = require("./aiImportErrorReporter");
var GEMINI_MODEL = "gemini-2.5-flash";
var AUDIT_PROMPT = "\u4F60\u662F\u4E2A\u4EBA\u8D22\u52A1\u5BA1\u8BA1\u5E08\u3002\u8BF7\u9010\u6761\u68C0\u67E5\u4EE5\u4E0B\u5168\u90E8\u539F\u59CB\u8D26\u5355\u6570\u636E\uFF0C\u4E0D\u8981\u9057\u6F0F\u4EFB\u4F55\u4E00\u6761\u3002\n\n\u5982\u6709\u9700\u8981\u7528\u6237\u786E\u8BA4\u7684\u4E8B\u9879\uFF0C\u8BF7\u53EA\u8F93\u51FA\u4EE5\u4E0B JSON \u683C\u5F0F\uFF08\u4E0D\u8981\u8F93\u51FA\u5176\u4ED6\u6587\u5B57\u3001\u4E0D\u8981\u8F93\u51FA CSV\uFF09\uFF1A\n{\"type\":\"questions\",\"questions\":[{\"id\":\"q1\",\"question\":\"\u95EE\u9898\u63CF\u8FF0\",\"context\":\"\u76F8\u5173\u4E0A\u4E0B\u6587\uFF08\u5982\u65E5\u671F\u3001\u91D1\u989D\u3001\u4EA4\u6613\u5BF9\u65B9\uFF09\"}]}\n\n\u5E38\u89C1\u9700\u786E\u8BA4\u4E8B\u9879\uFF08\u8BF7\u9488\u5BF9\u5177\u4F53\u8BB0\u5F55\u63D0\u95EE\uFF0C\u8BA9\u7528\u6237\u660E\u786E\u56DE\u7B54\uFF09\uFF1A\n- \u5927\u989D\u8F6C\u8D26/\u652F\u51FA\uFF1A\u8BF7\u5177\u4F53\u95EE\u300C\u67D0\u7B14 X \u5143\u8F6C\u8D26\uFF08\u65E5\u671F\u3001\u4EA4\u6613\u5BF9\u65B9\uFF09\u5177\u4F53\u7528\u9014\u662F\u4EC0\u4E48\uFF1F\u5E94\u5F52\u5165\u54EA\u4E00\u7C7B\uFF1F\u300D\n- \u91D1\u989D\u5F02\u5E38\uFF1A\u5355\u7B14\u8D85\u8FC7 1 \u4E07\u5143\u3001\u4E0E\u65E5\u5E38\u6D88\u8D39\u5DEE\u5F02\u5927\uFF0C\u9700\u7528\u6237\u786E\u8BA4\n- \u5206\u7C7B\u6B67\u4E49\uFF1A\u65E0\u6CD5\u786E\u5B9A\u5E94\u5F52\u5165\u54EA\u4E00\u7C7B\uFF0C\u8BF7\u5217\u51FA\u9009\u9879\u8BA9\u7528\u6237\u9009\u62E9\n- \u7591\u4F3C\u91CD\u590D\u8BB0\u5F55\uFF1A\u9700\u7528\u6237\u786E\u8BA4\u662F\u5426\u5220\u9664\n- \u7591\u4F3C\u9000\u6B3E/\u56DE\u6B3E/\u8F6C\u8D26\uFF1A\u9700\u7528\u6237\u786E\u8BA4\u662F\u5426\u8BA1\u5165\u6536\u5165\u3001\u5E94\u5982\u4F55\u5BF9\u51B2\n- \u4EA4\u6613\u5BF9\u65B9\u6216\u8BF4\u660E\u4E0D\u6E05\uFF1A\u9700\u7528\u6237\u8865\u5145\u8BF4\u660E\n\n\u82E5\u6CA1\u6709\u9700\u8981\u786E\u8BA4\u7684\uFF0C\u8BF7\u53EA\u8F93\u51FA\uFF1A{\"type\":\"ok\"}";
var SUMMARY_PROMPT = "\u4F60\u662F\u4E2A\u4EBA\u8D22\u52A1\u5BA1\u8BA1\u5E08\u3002\u8BF7\u5BF9\u4EE5\u4E0B\u539F\u59CB\u8D26\u5355\u6570\u636E\u8FDB\u884C\u8BE6\u7EC6\u6982\u89C8\u5206\u6790\u3002\n\n\u8BF7\u53EA\u8F93\u51FA\u4EE5\u4E0B JSON \u683C\u5F0F\uFF08\u4E0D\u8981\u8F93\u51FA\u5176\u4ED6\u6587\u5B57\uFF09\uFF1A\n{\n  \"estimatedCount\": 150,\n  \"dateRange\": \"2024-01-01 \u81F3 2024-01-31\",\n  \"sources\": [\"\u5FAE\u4FE1\", \"\u652F\u4ED8\u5B9D\"],\n  \"noiseCount\": 5,\n  \"qualityRating\": \"\u53EF\u7528\",\n  \"summaryText\": \"\u6570\u636E\u6574\u4F53\u5B8C\u6574\uFF0C\u5305\u542B\u5FAE\u4FE1\u548C\u652F\u4ED8\u5B9D\u8D26\u5355\uFF0C\u53D1\u73B0\u5C11\u91CF\u9000\u6B3E\u8BB0\u5F55\u3002\",\n  \"totalExpense\": 15000.00,\n  \"totalIncome\": 8000.00,\n  \"top10Expense\": [\n    {\"amount\": 5000, \"description\": \"\u623F\u79DF\", \"date\": \"2024-01-05\", \"type\": \"expense\"},\n    {\"amount\": 1200, \"description\": \"\u9910\u996E\", \"date\": \"2024-01-10\", \"type\": \"expense\"}\n  ],\n  \"top10Income\": [\n    {\"amount\": 5000, \"description\": \"\u5DE5\u8D44\", \"date\": \"2024-01-15\", \"type\": \"income\"}\n  ],\n  \"categoryBreakdown\": [\n    {\"category\": \"\u4F4F\u623F\u7269\u4E1A\", \"count\": 1, \"amount\": 5000},\n    {\"category\": \"\u9910\u996E\u7F8E\u98DF\", \"count\": 12, \"amount\": 1200}\n  ],\n  \"recordGuidance\": \"\u5EFA\u8BAE\uFF1A1. \u623F\u79DF\u8BB0\u4E3A\u4F4F\u623F\u7269\u4E1A\uFF1B2. \u7FA4\u6536\u6B3E\u7B49 AA \u56DE\u6B3E\u53EF\u5BF9\u51B2\u5BF9\u5E94\u6D88\u8D39\uFF1B3. \u9000\u6B3E\u8BB0\u5F55\u5DF2\u5254\u9664\u3002\"\n}\n\n\u5176\u4E2D qualityRating \u53EA\u80FD\u662F \"\u53EF\u7528\"\u3001\"\u90E8\u5206\u53EF\u7528\" \u6216 \"\u5EFA\u8BAE\u4E0D\u5BFC\u5165\" \u4E4B\u4E00\u3002\nnoiseCount \u6307\u7591\u4F3C\u9000\u6B3E\u3001\u4EA4\u6613\u5173\u95ED\u7B49\u975E\u771F\u5B9E\u6D88\u8D39\u8BB0\u5F55\u7684\u4F30\u7B97\u6570\u91CF\u3002\ntop10Expense/top10Income \u5404\u6700\u591A 10 \u6761\uFF0C\u6309\u91D1\u989D\u964D\u5E8F\u3002\ncategoryBreakdown \u5217\u51FA\u4E3B\u8981\u5206\u7C7B\u3002\nrecordGuidance \u7ED9\u51FA 2-4 \u6761\u5177\u4F53\u8BB0\u5F55\u5EFA\u8BAE\uFF0C\u5E2E\u52A9\u7528\u6237\u5224\u65AD\u6570\u636E\u662F\u5426\u51C6\u786E\u3002";
/** 从原始文本中启发式提取基础概览（AI 失败时静默兜底，不向用户暴露异常） */
function buildFallbackSummary(rawText) {
    var lines = rawText.split("\n").filter(function (l) { return l.trim(); });
    var estimatedCount = 0;
    var totalExpense = 0;
    var totalIncome = 0;
    var sources = [];
    if (/微信|wechat/i.test(rawText))
        sources.push("微信");
    if (/支付宝|alipay/i.test(rawText))
        sources.push("支付宝");
    for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
        var line = lines_1[_i];
        var m1 = line.match(/共\s*(\d+)\s*笔/);
        if (m1)
            estimatedCount = Math.max(estimatedCount, parseInt(m1[1], 10));
        // 支出：138笔 11864.58元 或 支出：138笔11864.58元
        var m2 = line.match(/支出[：:]\s*(\d+)\s*笔\s*([\d.,]+)\s*元?/);
        if (m2)
            totalExpense = parseFloat(m2[2].replace(/,/g, "")) || totalExpense;
        var m3 = line.match(/收入[：:]\s*(\d+)\s*笔\s*([\d.,]+)\s*元?/);
        if (m3)
            totalIncome = parseFloat(m3[2].replace(/,/g, "")) || totalIncome;
    }
    if (estimatedCount === 0) {
        var dataLines = lines.filter(function (l) { return /^\d{4}[-/年]/.test(l) || /,.*,.*\d+\.?\d*/.test(l); });
        estimatedCount = Math.max(dataLines.length, lines.length >> 1);
    }
    var dateMatch = rawText.match(/(\d{4})[-/年](\d{1,2})[-/月]/);
    var dateRange = dateMatch
        ? "".concat(dateMatch[1], "-").concat(dateMatch[2].padStart(2, "0"), "-01 \u81F3 ").concat(dateMatch[1], "-").concat(dateMatch[2].padStart(2, "0"), "-\u6708\u672B")
        : "未知";
    var sourceStr = sources.length ? sources.join("、") : "未知";
    // 尝试使用精确统计
    var exactStats = extractExactStats(rawText);
    if (exactStats.estimatedCount > 0) {
        estimatedCount = exactStats.estimatedCount;
        totalExpense = exactStats.totalExpense;
        totalIncome = exactStats.totalIncome;
    }
    // 如果没有识别到任何数据，尝试简单的行数估算
    if (estimatedCount === 0) {
        var dataLines = lines.filter(function (l) { return /^\d{4}[-/年]/.test(l) || /,.*,.*\d+\.?\d*/.test(l); });
        estimatedCount = Math.max(dataLines.length, lines.length >> 1);
    }
    var summaryText = totalExpense > 0 || totalIncome > 0
        ? "\u6570\u636E\u6574\u4F53\u5B8C\u6574\uFF0C\u5305\u542B".concat(sourceStr, "\u8D26\u5355\u3002\u652F\u51FA\u7EA6 \u00A5").concat(totalExpense.toLocaleString("zh-CN"), "\uFF0C\u6536\u5165\u7EA6 \u00A5").concat(totalIncome.toLocaleString("zh-CN"), "\u3002")
        : "\u6570\u636E\u6574\u4F53\u5B8C\u6574\uFF0C\u5305\u542B".concat(sourceStr, "\u8D26\u5355\uFF0C\u5171\u7EA6 ").concat(estimatedCount, " \u6761\u8BB0\u5F55\u3002");
    return {
        estimatedCount: Math.min(estimatedCount, 10000),
        dateRange: dateRange,
        sources: sources.length ? sources : ["未知"],
        noiseCount: 0,
        qualityRating: "可用",
        summaryText: summaryText,
        totalExpense: totalExpense > 0 ? totalExpense : undefined,
        totalIncome: totalIncome > 0 ? totalIncome : undefined,
        top10Expense: exactStats.top10Expense.length > 0 ? exactStats.top10Expense : undefined,
        top10Income: exactStats.top10Income.length > 0 ? exactStats.top10Income : undefined,
        categoryBreakdown: exactStats.categoryBreakdown.length > 0 ? exactStats.categoryBreakdown : undefined,
    };
}
/** 尝试修复常见 JSON 问题后解析 */
function tryParseJson(text) {
    var jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch)
        return null;
    var raw = jsonMatch[0];
    try {
        return JSON.parse(raw);
    }
    catch (_a) {
        // 尝试修复：尾随逗号、单引号、未转义换行等
        var fixed = raw
            .replace(/,(\s*[}\]])/g, "$1")
            .replace(/'/g, '"')
            .replace(/\n/g, "\\n")
            .replace(/\r/g, "");
        try {
            return JSON.parse(fixed);
        }
        catch (_b) {
            return null;
        }
    }
}
/** 提取精确的统计数据，避免 AI 幻觉 */
function extractExactStats(rawText) {
    var totalExpense = 0;
    var totalIncome = 0;
    var estimatedCount = 0;
    var top10Expense = [];
    var top10Income = [];
    var categoryBreakdown = [];
    var lines = rawText.split("\n");
    var headerFound = false;
    // 1. 尝试从微信/支付宝的头部提取（如果存在）
    for (var _i = 0, lines_2 = lines; _i < lines_2.length; _i++) {
        var line = lines_2[_i];
        var m1 = line.match(/共\s*(\d+)\s*笔/);
        if (m1) {
            estimatedCount += parseInt(m1[1], 10);
            headerFound = true;
        }
        var m2 = line.match(/(?:支出|已支出)[：:]\s*\d+\s*笔\s*[,，]?\s*([\d.,]+)\s*元?/);
        if (m2) {
            totalExpense += parseFloat(m2[1].replace(/,/g, ""));
            headerFound = true;
        }
        var m3 = line.match(/(?:收入|已收入)[：:]\s*\d+\s*笔\s*[,，]?\s*([\d.,]+)\s*元?/);
        if (m3) {
            totalIncome += parseFloat(m3[1].replace(/,/g, ""));
            headerFound = true;
        }
    }
    // 2. 始终尝试作为 CSV 解析以获取分类和 Top 10 明细
    var csvValidRows = 0;
    var csvTotalExpense = 0;
    var csvTotalIncome = 0;
    var expenses = [];
    var incomes = [];
    var catMap = new Map();
    var headerIndex = lines.findIndex(function (l) { return l.includes('金额') && (l.includes('收支') || l.includes('收/支') || l.includes('交易类型')); });
    if (headerIndex !== -1) {
        var csvText = lines.slice(headerIndex).join('\n');
        var parsed = papaparse_1.default.parse(csvText, { header: true, skipEmptyLines: true });
        if (parsed.data && parsed.data.length > 0) {
            for (var _a = 0, _b = parsed.data; _a < _b.length; _a++) {
                var row = _b[_a];
                var typeStr = row['收支'] || row['收/支'] || row['交易类型'] || '';
                var amountStr = row['金额_净值'] || row['金额(元)'] || row['金额'] || '0';
                var amount = Math.abs(parseFloat(amountStr.replace(/¥|,/g, '')));
                var desc = (row['商品说明'] || row['商品'] || row['交易对方'] || row['备注'] || '未知').trim();
                var date = row['交易时间'] || row['时间'] || row['日期'] || '';
                var category = (row['精细分类'] || row['审计分类'] || row['分类'] || row['交易分类'] || '未分类').trim();
                if (isNaN(amount) || amount === 0)
                    continue;
                csvValidRows++;
                var isExp = false;
                var isInc = false;
                if (typeStr.includes('支出')) {
                    csvTotalExpense += amount;
                    isExp = true;
                    expenses.push({ amount: amount, description: desc, date: date, type: 'expense' });
                }
                else if (typeStr.includes('收入')) {
                    csvTotalIncome += amount;
                    isInc = true;
                    incomes.push({ amount: amount, description: desc, date: date, type: 'income' });
                }
                else if (typeStr.includes('不计收支')) {
                    var netRaw = row['金额_净值'];
                    if (netRaw !== undefined && netRaw.trim() !== "") {
                        var netValue = parseFloat(netRaw);
                        if (!isNaN(netValue) && netValue !== 0) {
                            if (netValue > 0) {
                                isExp = true;
                                expenses.push({ amount: Math.abs(netValue), description: desc, date: date, type: 'expense' });
                            }
                            else {
                                isInc = true;
                                incomes.push({ amount: Math.abs(netValue), description: desc, date: date, type: 'income' });
                            }
                        }
                    }
                }
                if (isExp || isInc) {
                    var existing = catMap.get(category) || { count: 0, amount: 0 };
                    existing.count++;
                    existing.amount += amount;
                    catMap.set(category, existing);
                }
            }
        }
    }
    if (csvValidRows > 0) {
        if (!headerFound) {
            estimatedCount = csvValidRows;
            totalExpense = csvTotalExpense;
            totalIncome = csvTotalIncome;
        }
        expenses.sort(function (a, b) { return b.amount - a.amount; });
        incomes.sort(function (a, b) { return b.amount - a.amount; });
        top10Expense = expenses.slice(0, 10);
        top10Income = incomes.slice(0, 10);
        categoryBreakdown = Array.from(catMap.entries()).map(function (_a) {
            var category = _a[0], _b = _a[1], count = _b.count, amount = _b.amount;
            return ({ category: category, count: count, amount: amount });
        }).sort(function (a, b) { return b.amount - a.amount; });
    }
    else if (!headerFound && estimatedCount === 0) {
        // 逐行正则匹配兜底
        for (var _c = 0, lines_3 = lines; _c < lines_3.length; _c++) {
            var line = lines_3[_c];
            if (line.includes('支出') || line.includes('收入')) {
                var parts = line.split(',');
                var amount = 0;
                var type = '';
                for (var i = 0; i < parts.length; i++) {
                    if (parts[i] === '支出' || parts[i] === '收入') {
                        type = parts[i];
                        if (i + 1 < parts.length) {
                            var parsedAmount = parseFloat(parts[i + 1].replace(/¥|,/g, ''));
                            if (!isNaN(parsedAmount)) {
                                amount = Math.abs(parsedAmount);
                                break;
                            }
                        }
                    }
                }
                if (amount > 0) {
                    estimatedCount++;
                    if (type === '支出')
                        totalExpense += amount;
                    if (type === '收入')
                        totalIncome += amount;
                }
            }
        }
    }
    return { totalExpense: totalExpense, totalIncome: totalIncome, estimatedCount: estimatedCount, top10Expense: top10Expense, top10Income: top10Income, categoryBreakdown: categoryBreakdown };
}
function generateDataSummary(rawText, apiKey, signal) {
    return __awaiter(this, void 0, void 0, function () {
        var url, sampleText, exactStats, promptWithStats, doRequest, lastErr, attempt, text, parsed, err_1;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    url = "https://generativelanguage.googleapis.com/v1beta/models/".concat(GEMINI_MODEL, ":generateContent?key=").concat(encodeURIComponent(apiKey));
                    sampleText = rawText.split("\n").slice(0, 300).join("\n");
                    exactStats = extractExactStats(rawText);
                    promptWithStats = SUMMARY_PROMPT;
                    if (exactStats.estimatedCount > 0) {
                        promptWithStats += "\n\n\u3010\u91CD\u8981\u63D0\u793A\u3011\u6211\u5DF2\u7ECF\u4E3A\u4F60\u8BA1\u7B97\u4E86\u7CBE\u786E\u7684\u7EDF\u8BA1\u6570\u636E\uFF0C\u8BF7\u76F4\u63A5\u4F7F\u7528\u4EE5\u4E0B\u6570\u503C\uFF0C\u4E0D\u8981\u81EA\u5DF1\u8BA1\u7B97\uFF1A\n- \u9884\u4F30\u8BB0\u5F55\u6570 (estimatedCount): ".concat(exactStats.estimatedCount, "\n- \u9884\u4F30\u603B\u652F\u51FA (totalExpense): ").concat(exactStats.totalExpense.toFixed(2), "\n- \u9884\u4F30\u603B\u6536\u5165 (totalIncome): ").concat(exactStats.totalIncome.toFixed(2));
                    }
                    doRequest = function () { return __awaiter(_this, void 0, void 0, function () {
                        var res, errBody, data, respCheck;
                        var _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0: return [4 /*yield*/, fetch(url, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                            contents: [
                                                { parts: [{ text: promptWithStats }, { text: "原始数据：\n" + sampleText }] },
                                            ],
                                            generationConfig: {
                                                maxOutputTokens: 16384,
                                                temperature: 0.1,
                                                responseMimeType: "application/json",
                                            },
                                        }),
                                        signal: signal,
                                    })];
                                case 1:
                                    res = _b.sent();
                                    if (!!res.ok) return [3 /*break*/, 3];
                                    return [4 /*yield*/, res.text()];
                                case 2:
                                    errBody = _b.sent();
                                    throw new Error(errBody || "API \u9519\u8BEF: ".concat(res.status));
                                case 3: return [4 /*yield*/, res.json()];
                                case 4:
                                    data = _b.sent();
                                    respCheck = (0, aiImportValidation_1.validateGeminiResponse)(data);
                                    if (!respCheck.valid) {
                                        throw new Error((_a = respCheck.error) !== null && _a !== void 0 ? _a : "API 返回异常");
                                    }
                                    return [2 /*return*/, respCheck.text.replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "").trim()];
                            }
                        });
                    }); };
                    attempt = 0;
                    _a.label = 1;
                case 1:
                    if (!(attempt < 2)) return [3 /*break*/, 7];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, doRequest()];
                case 3:
                    text = _a.sent();
                    parsed = tryParseJson(text);
                    if (parsed) {
                        // 强制覆盖为精确计算的数值，防止 AI 幻觉
                        if (exactStats.estimatedCount > 0) {
                            parsed.estimatedCount = exactStats.estimatedCount;
                            parsed.totalExpense = exactStats.totalExpense;
                            parsed.totalIncome = exactStats.totalIncome;
                            if (exactStats.top10Expense.length > 0) {
                                parsed.top10Expense = exactStats.top10Expense;
                            }
                            if (exactStats.top10Income.length > 0) {
                                parsed.top10Income = exactStats.top10Income;
                            }
                            if (exactStats.categoryBreakdown.length > 0) {
                                parsed.categoryBreakdown = exactStats.categoryBreakdown;
                            }
                        }
                        return [2 /*return*/, (0, aiImportValidation_1.sanitizeDataSummary)(parsed)];
                    }
                    lastErr = new Error("AI 返回格式无法解析");
                    return [3 /*break*/, 5];
                case 4:
                    err_1 = _a.sent();
                    if (err_1 instanceof Error && (err_1.message === "Aborted" || err_1.name === "AbortError")) {
                        throw err_1;
                    }
                    lastErr = err_1;
                    return [3 /*break*/, 5];
                case 5:
                    if (attempt === 1)
                        return [3 /*break*/, 7];
                    _a.label = 6;
                case 6:
                    attempt++;
                    return [3 /*break*/, 1];
                case 7:
                    (0, aiImportErrorReporter_1.reportSummaryParseError)(sampleText, lastErr);
                    return [2 /*return*/, buildFallbackSummary(rawText)];
            }
        });
    });
}
function auditForQuestions(rawText, apiKey, signal) {
    return __awaiter(this, void 0, void 0, function () {
        var url, fullText, res, errBody, data, respCheck, text, jsonMatch, parsed, questions;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    url = "https://generativelanguage.googleapis.com/v1beta/models/".concat(GEMINI_MODEL, ":generateContent?key=").concat(encodeURIComponent(apiKey));
                    fullText = rawText.trim();
                    return [4 /*yield*/, fetch(url, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                contents: [
                                    {
                                        parts: [
                                            { text: AUDIT_PROMPT },
                                            { text: "原始数据（请逐条检查全部记录）：\n" + fullText },
                                        ],
                                    },
                                ],
                                generationConfig: {
                                    maxOutputTokens: 8192,
                                    temperature: 0.1,
                                },
                            }),
                            signal: signal,
                        })];
                case 1:
                    res = _a.sent();
                    if (!!res.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, res.text()];
                case 2:
                    errBody = _a.sent();
                    throw new Error(errBody || "API \u9519\u8BEF: ".concat(res.status));
                case 3: return [4 /*yield*/, res.json()];
                case 4:
                    data = _a.sent();
                    respCheck = (0, aiImportValidation_1.validateGeminiResponse)(data);
                    if (!respCheck.valid) {
                        return [2 /*return*/, { hasQuestions: false, questions: [] }];
                    }
                    text = respCheck.text;
                    text = text.replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "").trim();
                    jsonMatch = text.match(/\{[\s\S]*\}/);
                    if (!jsonMatch) {
                        return [2 /*return*/, { hasQuestions: false, questions: [] }];
                    }
                    try {
                        parsed = JSON.parse(jsonMatch[0]);
                        if (parsed.type === "questions" && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
                            questions = (0, aiImportValidation_1.sanitizeAuditQuestions)(parsed.questions);
                            if (questions.length > 0) {
                                return [2 /*return*/, { hasQuestions: true, questions: questions }];
                            }
                        }
                    }
                    catch (_b) {
                        /* ignore */
                    }
                    return [2 /*return*/, { hasQuestions: false, questions: [] }];
            }
        });
    });
}
/** 每批行数，过大会导致 Gemini 输出被 MAX_TOKENS 截断，100 是一个速度与稳定性的良好平衡点 */
var DEFAULT_BATCH_LINES = 100;
/** 每批预计耗时（秒），用于进度提示 */
exports.ESTIMATED_SEC_PER_BATCH = 15;
function splitRawText(text, batchLines) {
    if (batchLines === void 0) { batchLines = DEFAULT_BATCH_LINES; }
    var lines = text.split("\n");
    var batches = [];
    for (var i = 0; i < lines.length; i += batchLines) {
        batches.push(lines.slice(i, i + batchLines).join("\n"));
    }
    return batches;
}
function callGeminiClean(batchText, apiKey, rules, signal, userAnswers, globalInstruction) {
    return __awaiter(this, void 0, void 0, function () {
        var url, systemPrompt, answersText, res, errBody, data, respCheck, text, finishReason, csvCheck;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    url = "https://generativelanguage.googleapis.com/v1beta/models/".concat(GEMINI_MODEL, ":generateContent?key=").concat(encodeURIComponent(apiKey));
                    systemPrompt = (0, importRules_1.buildCleaningPrompt)(rules);
                    if (userAnswers && Object.keys(userAnswers).length > 0) {
                        answersText = Object.entries(userAnswers)
                            .map(function (_a) {
                            var id = _a[0], ans = _a[1];
                            return "\u7528\u6237\u5BF9 ".concat(id, " \u7684\u56DE\u7B54\uFF1A").concat(ans);
                        })
                            .join("\n");
                        systemPrompt += "\n\n\u3010\u7528\u6237\u5DF2\u786E\u8BA4\u3011\u8BF7\u6309\u4EE5\u4E0B\u7528\u6237\u56DE\u7B54\u5904\u7406\u6570\u636E\uFF1A\n".concat(answersText);
                    }
                    if (globalInstruction && globalInstruction.trim()) {
                        systemPrompt += "\n\n\u3010\u8865\u5145\u6E05\u6D17\u53E3\u5F84\u3011\u7528\u6237\u8865\u5145\u4E86\u4EE5\u4E0B\u5168\u5C40\u6E05\u6D17\u53E3\u5F84\uFF0C\u8BF7\u4E25\u683C\u9075\u5B88\u5E76\u5728\u6570\u636E\u6E05\u6D17\u65F6\u5E94\u7528\uFF1A\n".concat(globalInstruction);
                    }
                    return [4 /*yield*/, fetch(url, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                contents: [
                                    {
                                        parts: [
                                            { text: systemPrompt },
                                            { text: "以下是原始账单数据：\n" + batchText },
                                        ],
                                    },
                                ],
                                generationConfig: {
                                    maxOutputTokens: 32768,
                                    temperature: 0.1,
                                },
                            }),
                            signal: signal,
                        })];
                case 1:
                    res = _c.sent();
                    if (!!res.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, res.text()];
                case 2:
                    errBody = _c.sent();
                    throw new Error(errBody || "API \u9519\u8BEF: ".concat(res.status));
                case 3: return [4 /*yield*/, res.json()];
                case 4:
                    data = (_c.sent());
                    respCheck = (0, aiImportValidation_1.validateGeminiResponse)(data);
                    if (!respCheck.valid) {
                        console.warn("[Bill-App AI\u5BFC\u5165] \u6E05\u6D17\u6279\u6B21\u5F02\u5E38: ".concat(respCheck.error, "\uFF0C\u8BE5\u6279\u8DF3\u8FC7"));
                        return [2 /*return*/, "交易时间,精细分类,收支,金额,金额_净值,交易对方,商品说明,来源,必要性打标,备注\n"];
                    }
                    text = respCheck.text;
                    finishReason = (_b = (_a = data.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.finishReason;
                    if (finishReason === "MAX_TOKENS") {
                        console.warn("Gemini 输出被 token 限制截断，本批次可能不完整");
                    }
                    // Clean markdown code blocks if any
                    text = text.replace(/^\`\`\`(?:csv)?\s*/i, "").replace(/\s*\`\`\`$/, "").trim();
                    csvCheck = (0, aiImportValidation_1.validateGeminiCsvOutput)(text);
                    if (!csvCheck.valid) {
                        console.warn("\u672C\u6279\u6B21 AI \u8F93\u51FA\u5F02\u5E38: ".concat(csvCheck.error, "\uFF0C\u8BE5\u6279\u5C06\u8DF3\u8FC7"));
                        return [2 /*return*/, "交易时间,精细分类,收支,金额,金额_净值,交易对方,商品说明,来源,必要性打标,备注\n"];
                    }
                    return [2 /*return*/, text];
            }
        });
    });
}
function safeRandomUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
function processAIImport(rawText, apiKey, rules, onProgress, signal, userAnswers, globalInstruction) {
    return __awaiter(this, void 0, void 0, function () {
        var documentId, exactStats, lines, headerIndex, headerLine, csvText, parsed, records, dedup_1, _i, records_1, record, batches, allRecords, completedBatches, EMPTY_CSV, processBatch, CONCURRENCY, _loop_1, i, dedup, _a, allRecords_1, record;
        var _this = this;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    documentId = safeRandomUUID();
                    exactStats = extractExactStats(rawText);
                    if (exactStats.estimatedCount > 0) {
                        lines = rawText.split("\n");
                        headerIndex = lines.findIndex(function (l) { return l.includes('金额') && (l.includes('收支') || l.includes('收/支') || l.includes('交易类型')); });
                        if (headerIndex !== -1) {
                            headerLine = lines[headerIndex];
                            // 检查是否包含标准表头
                            if (headerLine.includes('交易时间') && headerLine.includes('精细分类') && headerLine.includes('金额_净值')) {
                                console.log("检测到标准格式 CSV，跳过 AI 清洗直接导入");
                                csvText = lines.slice(headerIndex).join('\n');
                                parsed = (0, csv_1.parseCsvText)(csvText);
                                if (parsed.data && parsed.data.length > 0) {
                                    onProgress === null || onProgress === void 0 ? void 0 : onProgress(1, 1);
                                    records = (0, csv_1.rowsToRecords)(parsed.data, documentId).filter(aiImportValidation_1.isValidBillRecord);
                                    dedup_1 = new Map();
                                    for (_i = 0, records_1 = records; _i < records_1.length; _i++) {
                                        record = records_1[_i];
                                        dedup_1.set(record.hash, record);
                                    }
                                    return [2 /*return*/, __spreadArray([], dedup_1.values(), true)];
                                }
                            }
                        }
                    }
                    batches = splitRawText(rawText, DEFAULT_BATCH_LINES);
                    allRecords = [];
                    completedBatches = 0;
                    EMPTY_CSV = "交易时间,精细分类,收支,金额,金额_净值,交易对方,商品说明,来源,必要性打标,备注\n";
                    processBatch = function (batchText, index) { return __awaiter(_this, void 0, void 0, function () {
                        var csvText, err_2, parsed, csvCheck, records;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    if (signal === null || signal === void 0 ? void 0 : signal.aborted) {
                                        throw new Error("Aborted");
                                    }
                                    _a.label = 1;
                                case 1:
                                    _a.trys.push([1, 3, , 4]);
                                    return [4 /*yield*/, callGeminiClean(batchText, apiKey, rules, signal, userAnswers, globalInstruction)];
                                case 2:
                                    csvText = _a.sent();
                                    return [3 /*break*/, 4];
                                case 3:
                                    err_2 = _a.sent();
                                    if (err_2 instanceof Error && (err_2.message === "Aborted" || err_2.name === "AbortError")) {
                                        throw err_2;
                                    }
                                    console.warn("[Bill-App AI\u5BFC\u5165] \u6279\u6B21 ".concat(index + 1, "/").concat(batches.length, " \u5931\u8D25\uFF0C\u8DF3\u8FC7:"), err_2);
                                    csvText = EMPTY_CSV;
                                    return [3 /*break*/, 4];
                                case 4:
                                    try {
                                        parsed = (0, csv_1.parseCsvText)(csvText);
                                    }
                                    catch (parseErr) {
                                        console.warn("\u6279\u6B21 ".concat(index + 1, "/").concat(batches.length, " \u89E3\u6790\u5931\u8D25:"), parseErr);
                                        parsed = { data: [] };
                                    }
                                    csvCheck = (0, aiImportValidation_1.validateParsedCsv)(parsed);
                                    if (!csvCheck.valid) {
                                        console.warn("\u6279\u6B21 ".concat(index + 1, "/").concat(batches.length, " \u8868\u5934\u6821\u9A8C\u5931\u8D25: ").concat(csvCheck.error));
                                    }
                                    records = (0, csv_1.rowsToRecords)(parsed.data, documentId).filter(aiImportValidation_1.isValidBillRecord);
                                    completedBatches++;
                                    onProgress === null || onProgress === void 0 ? void 0 : onProgress(completedBatches, batches.length);
                                    return [2 /*return*/, records];
                            }
                        });
                    }); };
                    CONCURRENCY = 3;
                    _loop_1 = function (i) {
                        var chunk, chunkResults, _c, chunkResults_1, records;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0:
                                    chunk = batches.slice(i, i + CONCURRENCY);
                                    return [4 /*yield*/, Promise.all(chunk.map(function (batchText, idx) { return processBatch(batchText, i + idx); }))];
                                case 1:
                                    chunkResults = _d.sent();
                                    for (_c = 0, chunkResults_1 = chunkResults; _c < chunkResults_1.length; _c++) {
                                        records = chunkResults_1[_c];
                                        allRecords.push.apply(allRecords, records);
                                    }
                                    return [2 /*return*/];
                            }
                        });
                    };
                    i = 0;
                    _b.label = 1;
                case 1:
                    if (!(i < batches.length)) return [3 /*break*/, 4];
                    return [5 /*yield**/, _loop_1(i)];
                case 2:
                    _b.sent();
                    _b.label = 3;
                case 3:
                    i += CONCURRENCY;
                    return [3 /*break*/, 1];
                case 4:
                    dedup = new Map();
                    for (_a = 0, allRecords_1 = allRecords; _a < allRecords_1.length; _a++) {
                        record = allRecords_1[_a];
                        dedup.set(record.hash, record);
                    }
                    return [2 /*return*/, __spreadArray([], dedup.values(), true)];
            }
        });
    });
}
/** 根据原始文本估算批次数，用于进度提示 */
function estimateBatchCount(text) {
    return splitRawText(text).length;
}
