const fs = require("fs");
const Papa = require("papaparse");
const XLSX = require("xlsx");

const data = fs.readFileSync("/Users/kay.zhong/Desktop/AI/Bill App/原始账单文件/2026_2微信.xlsx");
const workbook = XLSX.read(data, { type: "buffer" });
const firstSheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[firstSheetName];
const csvText = XLSX.utils.sheet_to_csv(worksheet, { forceQuotes: true });

console.log("Converted CSV length:", csvText.length);
console.log("First 500 chars:", csvText.substring(0, 500));

// Wait, the AIImportPage takes this CSV and sends it to AI. 
// Then AI returns a standard CSV.
// Let's see what the AI returns. We can't easily mock that.
// BUT, the issue is "共成功解析并去重 0 条记录".
// This happens after `processAIImport` -> `callGeminiClean` -> `parseCsvText` -> `rowsToRecords`.

