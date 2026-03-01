/**
 * AI 导入错误上报：内部记录问题，便于排查，不打扰用户
 * 可扩展为上报到监控服务
 */
const PREFIX = "[Bill-App AI导入]";

export interface ErrorReport {
  stage: string;
  message: string;
  raw?: string;
  stack?: string;
}

function report(report: ErrorReport) {
  console.error(`${PREFIX} ${report.stage}:`, report.message);
  if (report.raw) {
    console.error(`${PREFIX} 原始内容(前500字符):`, report.raw.slice(0, 500));
  }
  if (report.stack) {
    console.error(`${PREFIX} 堆栈:`, report.stack);
  }
  // 可在此接入监控上报，如: sendToXiaozhi(report);
}

export function reportSummaryParseError(rawText: string, parseError: unknown) {
  report({
    stage: "数据概览解析失败",
    message: String(parseError),
    raw: rawText,
    stack: parseError instanceof Error ? parseError.stack : undefined,
  });
}

export function reportApiError(stage: string, err: unknown) {
  report({
    stage,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
}
