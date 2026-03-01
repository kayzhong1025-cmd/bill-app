import fs from "fs";
import { parseCsvText, rowsToRecords } from "./src/lib/csv";
import { isValidBillRecord } from "./src/lib/aiImportValidation";

const text = fs.readFileSync("/Users/kay.zhong/Desktop/AI/Bill App/2025年度财务审计对账单_纯净版.csv", "utf-8");

const lines = text.split("\n");
const headerIndex = lines.findIndex(l => l.includes('金额') && (l.includes('收支') || l.includes('收/支') || l.includes('交易类型')));

if (headerIndex !== -1) {
  const csvText = lines.slice(headerIndex).join('\n');
  const parsed = parseCsvText(csvText);
  if (parsed.data && parsed.data.length > 0) {
    const records = rowsToRecords(parsed.data, "test-id");
    console.log("Total parsed by rowsToRecords:", records.length);
    
    const validRecords = records.filter(isValidBillRecord);
    console.log("Total valid records:", validRecords.length);
    
    if (records.length > 0 && validRecords.length === 0) {
        console.log("First invalid record:", records[0]);
        console.log("Why invalid?");
        const o = records[0] as any;
        console.log("hash string:", typeof o.hash === "string");
        console.log("hash length:", o.hash.length > 0);
        console.log("type:", o.type);
        console.log("type valid:", o.type === "income" || o.type === "expense" || o.type === "transfer");
        console.log("dateStr string:", typeof o.dateStr === "string");
        console.log("dateStr format:", /^\d{4}-\d{2}-\d{2}$/.test(o.dateStr));
        console.log("amount number:", typeof o.amount === "number");
        console.log("amount finite:", Number.isFinite(o.amount));
        console.log("amount > 0:", o.amount > 0);
    }
  }
}
