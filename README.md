# 账单看板 Bill App

基于 React + Vite + TypeScript + Tailwind CSS + IndexedDB 的现代账单分析应用。

## 技术栈

- **Vite** - 构建工具
- **React 19** - UI 框架
- **TypeScript** - 类型安全
- **Tailwind CSS** - 样式
- **Chart.js / react-chartjs-2** - 图表
- **PapaParse** - CSV 解析
- **LocalForage** - IndexedDB 存储
- **Lucide React** - 图标

## CSV 标准格式

列名需包含（可兼容别名）：

| 标准列名 | 兼容别名 |
|---------|----------|
| 交易时间 | 日期 |
| 精细分类 | 审计分类 |
| 收支类型 | 收支 |
| 金额 | 金额_净值 |
| 交易对方 | - |
| 商品说明 | 备注 |
| 来源 | - |
| 必要性打标 | - |
| 备注 | - |

## 快速开始

```bash
cd bill-app
npm install
npm run dev
```

浏览器访问 `http://localhost:5173`。

## 构建

```bash
npm run build
npm run preview
```

## AI 财务洞见

「AI 洞见」Tab 使用 Gemini 3.1 Pro 分析账单数据，生成 5 条财务洞见。需配置 Gemini API Key：

1. 在 [Google AI Studio](https://aistudio.google.com/apikey) 获取 API Key
2. 在应用内输入并勾选「记住」，或创建 `.env` 文件配置：
   ```
   VITE_GEMINI_API_KEY=AIza...
   ```
3. 支持按年份、按月份筛选分析范围

## 功能

- 暗/亮色主题切换 + 持久化
- CSV 导入（支持追加合并）
- 年份/月份全局筛选
- 收支概览卡片（总收入 / 总支出 / 结余）
- 支出/收入视图切换
- 分类饼图
- 趋势折线图
- Top 10 消费/收入记录表格
