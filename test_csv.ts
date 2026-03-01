import fs from "fs";
import { parseCsvText, rowsToRecords } from "./src/lib/csv";
import { extractExactStats } from "./src/lib/aiImport";

const text = fs.readFileSync("/Users/kay.zhong/Desktop/AI/Bill App/2025年度财务审计对账单_纯净版.csv", "utf-8");
const stats = extractExactStats(text);
console.log("Exact Stats:", stats);

const lines = text.split("\n");
const headerIndex = lines.findIndex(l => l.includes('金额') && (l.includes('收支') || l.includes('收/支') || l.includes('交易类型')));
const csvText = lines.slice(headerIndex).join('\n');
const parsed = parseCsvText(csvText);
const records = rowsToRecords(parsed.data, "test-id");
console.log("Parsed Records Count:", records.length);
const expenses = records.filter(r => r.type === "expense");
const incomes = records.filter(r => r.type === "income");
console.log("Expenses count:", expenses.length, "Total:", expenses.reduce((s, r) => s + r.amount, 0));
console.log("Incomes count:", incomes.length, "Total:", incomes.reduce((s, r) => s + r.amount, 0));

// Check how many have amount <= 0
console.log("Negative/Zero amounts:", records.filter(r => r.amount <= 0).length);
