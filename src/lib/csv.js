"use strict";
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
exports.validateCsvHeaders = validateCsvHeaders;
exports.parseCsvText = parseCsvText;
exports.rowsToRecords = rowsToRecords;
var papaparse_1 = __importDefault(require("papaparse"));
var MIN_REQUIRED = ["交易时间", "收支类型", "金额"];
var ALT_MAP = {
    交易时间: ["日期"],
    收支类型: ["收支"],
    金额: ["金额_净值"],
};
function normalizeDate(input) {
    if (!input)
        return null;
    var head = input.split(" ")[0].replaceAll("年", "-").replaceAll("月", "-").replaceAll("日", "");
    var parts = head.split("-").filter(Boolean);
    if (parts.length < 3)
        return null;
    var year = parts[0], month = parts[1], day = parts[2];
    return {
        dateStr: "".concat(year, "-").concat(month.padStart(2, "0"), "-").concat(day.padStart(2, "0")),
        year: year,
        month: month.padStart(2, "0"),
        day: day.padStart(2, "0"),
    };
}
function parseAmountAndType(row) {
    var _a, _b;
    var typeText = (_b = ((_a = row["收支类型"]) !== null && _a !== void 0 ? _a : row["收支"])) === null || _b === void 0 ? void 0 : _b.trim();
    // 仅接受：收入、支出、不计收支（与最终版对账单一致），其它如转账/交易关闭等忽略
    if (typeText && typeText !== "收入" && typeText !== "支出" && typeText !== "不计收支") {
        return null;
    }
    // 优先使用 "金额_净值"（与最终版对账单格式一致）
    var netRaw = row["金额_净值"];
    if (netRaw !== undefined && netRaw.trim() !== "") {
        var netValue = Number.parseFloat(netRaw);
        if (!Number.isNaN(netValue) && netValue !== 0) {
            // 净值 > 0 视为支出，净值 < 0 视为收入
            return {
                amount: Math.abs(netValue),
                type: netValue > 0 ? "expense" : "income",
            };
        }
    }
    // 退级使用 "金额" 和 "收支"
    var raw = row["金额"] || "0";
    var amount = Math.abs(Number.parseFloat(raw));
    if (!Number.isFinite(amount) || amount === 0)
        return null;
    if (typeText === "收入")
        return { amount: amount, type: "income" };
    if (typeText === "支出")
        return { amount: amount, type: "expense" };
    // 「不计收支」按金额正负：正数=支出，负数=收入（与最终版对账单一致）
    if (typeText === "不计收支")
        return { amount: amount, type: "expense" };
    return null;
}
function validateCsvHeaders(headers) {
    var _a;
    var exists = new Set(headers);
    var missing = [];
    for (var _i = 0, MIN_REQUIRED_1 = MIN_REQUIRED; _i < MIN_REQUIRED_1.length; _i++) {
        var key = MIN_REQUIRED_1[_i];
        var alts = (_a = ALT_MAP[key]) !== null && _a !== void 0 ? _a : [];
        var hasKey = exists.has(key) || alts.some(function (a) { return exists.has(a); });
        if (!hasKey)
            missing.push(key);
    }
    return { valid: missing.length === 0, missing: missing };
}
function parseCsvText(csvText) {
    return papaparse_1.default.parse(csvText, {
        header: true,
        skipEmptyLines: true,
    });
}
function rowsToRecords(rows, documentId) {
    var parsed = rows
        .map(function (row) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        var parsedAmt = parseAmountAndType(row);
        var date = normalizeDate((_a = row["交易时间"]) !== null && _a !== void 0 ? _a : row["日期"]);
        if (!date || !parsedAmt)
            return null;
        var amount = parsedAmt.amount, type = parsedAmt.type;
        var category = ((_c = ((_b = row["精细分类"]) !== null && _b !== void 0 ? _b : row["审计分类"])) === null || _c === void 0 ? void 0 : _c.trim()) || "未分类";
        if (type === "income" && category !== "年度总收入" && category !== "兼职收入") {
            type = "expense";
            amount = -amount;
        }
        var descRaw = ((_f = ((_e = (_d = row["商品说明"]) !== null && _d !== void 0 ? _d : row["备注"]) !== null && _e !== void 0 ? _e : row["交易对方"])) === null || _f === void 0 ? void 0 : _f.trim()) || "无说明";
        var description = descRaw.substring(0, 80);
        var counterparty = ((_g = row["交易对方"]) === null || _g === void 0 ? void 0 : _g.trim()) || "-";
        var source = ((_h = row["来源"]) === null || _h === void 0 ? void 0 : _h.trim()) || "-";
        var necessity = ((_j = row["必要性打标"]) === null || _j === void 0 ? void 0 : _j.trim()) || "未打标";
        var remark = ((_k = row["备注"]) === null || _k === void 0 ? void 0 : _k.trim()) || "";
        var hash = "".concat(date.dateStr, "_").concat(type, "_").concat(amount, "_").concat(description);
        return {
            hash: hash,
            type: type,
            dateStr: date.dateStr,
            year: date.year,
            month: date.month,
            day: date.day,
            category: category,
            amount: amount,
            counterparty: counterparty,
            description: description,
            source: source,
            necessity: necessity,
            remark: remark,
            documentId: documentId,
        };
    })
        .filter(Boolean);
    var dedup = new Map();
    for (var _i = 0, parsed_1 = parsed; _i < parsed_1.length; _i++) {
        var record = parsed_1[_i];
        dedup.set(record.hash, record);
    }
    return __spreadArray([], dedup.values(), true);
}
