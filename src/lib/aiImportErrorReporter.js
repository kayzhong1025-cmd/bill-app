"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportSummaryParseError = reportSummaryParseError;
exports.reportApiError = reportApiError;
/**
 * AI 导入错误上报：内部记录问题，便于排查，不打扰用户
 * 可扩展为上报到监控服务
 */
var PREFIX = "[Bill-App AI导入]";
function report(report) {
    console.error("".concat(PREFIX, " ").concat(report.stage, ":"), report.message);
    if (report.raw) {
        console.error("".concat(PREFIX, " \u539F\u59CB\u5185\u5BB9(\u524D500\u5B57\u7B26):"), report.raw.slice(0, 500));
    }
    if (report.stack) {
        console.error("".concat(PREFIX, " \u5806\u6808:"), report.stack);
    }
    // 可在此接入监控上报，如: sendToXiaozhi(report);
}
function reportSummaryParseError(rawText, parseError) {
    report({
        stage: "数据概览解析失败",
        message: String(parseError),
        raw: rawText,
        stack: parseError instanceof Error ? parseError.stack : undefined,
    });
}
function reportApiError(stage, err) {
    report({
        stage: stage,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
    });
}
