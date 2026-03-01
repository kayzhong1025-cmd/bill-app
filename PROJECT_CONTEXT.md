# Bill-App 项目上下文摘要

> 复制以下内容到新对话，帮助 AI 快速了解项目。

---

## 项目概述

个人账单看板应用，路径 `bill-app/`，技术栈：React 19 + Vite + TypeScript + Tailwind + IndexedDB (LocalForage) + Chart.js。

## 核心数据结构

```ts
// types/bill.ts
interface BillRecord {
  hash: string;        // 唯一标识
  type: "income" | "expense";
  dateStr: string;     // "2025-01-15"
  year, month, day: string;
  category: string;
  amount: number;      // 始终为正数
  counterparty: string;
  description: string;
  source: string;
  necessity: string;
  remark: string;
  documentId?: string;
}
```

## 主要功能模块

| Tab | 组件 | 功能 |
|-----|------|------|
| 数据看板 | Dashboard | 收支概览、分类饼图、Top 记录、热力图 |
| 趋势分析 | TrendTab | 现金流折线图、消费日历热力图、多月份对比 |
| 明细搜索 | SearchTab | 筛选、排序、分页、单条/批量编辑 |
| 文档管理 | DocumentsTab | 文档列表、导出 CSV、删除、**数据备份与恢复** |
| AI 洞见 | InsightTab | Gemini 分析，发现+建议卡片展示 |

## 关键文件

- `App.tsx` - 主应用，状态管理，Tab 切换
- `lib/storage.ts` - IndexedDB 读写，含 `createBackup`、`listBackups`、`restoreBackup`
- `lib/csv.ts` - CSV 解析 `rowsToRecords`，`parseAmountAndType`
- `lib/insight.ts` - `buildInsightContext` 构建 AI 分析上下文
- `lib/analytics.ts` - `getFilteredRecords`、`getSummary`、`toCategoryOptions`
- `components/InsightTab.tsx` - AI 洞见，Gemini API 调用，JSON 解析
- `components/EditRecordModal.tsx` - 单条编辑（类型、金额、分类等）
- `components/BatchEditModal.tsx` - 批量编辑

## 数据流

1. **导入**：CSV → `parseCsvText` → `rowsToRecords` → `saveRawData` + `saveDocuments`
2. **存储**：`rawData`、`documents` 存 IndexedDB，`saveRawData`、`saveDocuments`
3. **备份**：每天自动 `createBackup`，保留 1 份，在文档管理 Tab 可恢复

## AI 相关

- **Gemini**：模型 `gemini-3.1-pro-preview`，API Key 默认内置或 `VITE_GEMINI_API_KEY`
- **洞见**：要求 JSON 输出 `[{发现, 建议}]`，解析后展示为卡片
- **待做**：AI 数据清洗导入 - 用户粘贴原始文本，Gemini 解析为 BillRecord 数组

## 待实现：AI 数据清洗导入

**目标**：用户粘贴原始文本（聊天记录、笔记、非标准 CSV 等），由 Gemini 解析为结构化账单记录。

**流程**：原始文本 → 调用 Gemini（prompt 要求输出 JSON）→ 解析为 BillRecord[] → 预览 → 确认导入

**注意**：数据量大时分批处理（如 50–100 条/批），避免 token 超限。

---
