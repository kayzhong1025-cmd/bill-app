import * as XLSX from "xlsx";
import fs from "fs";
import Papa from "papaparse";
import type { CsvRow } from "./src/types/bill.js";
import { callGeminiClean } from "./src/lib/aiImport.js";
import { loadImportRules } from "./src/lib/importRules.js";

async function debug() {
  const apiKey = "AIzaSyB-3siaqFc1CDEGPmJVKFEXw-CeTFFHMZM";
  const rules = loadImportRules();

  let combinedText = "";
  const excelBuf = fs.readFileSync("/Users/kay.zhong/Desktop/AI/Bill App/原始账单文件/2026_2微信.xlsx");
  const workbook = XLSX.read(excelBuf, { type: "buffer" });
  const csv1 = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]], { forceQuotes: true });
  combinedText += `\n--- 文件: 2026_2微信.xlsx ---\n` + csv1 + "\n";

  const csvBuf = fs.readFileSync("/Users/kay.zhong/Desktop/AI/Bill App/原始账单文件/2026_2支付宝.csv");
  let csv2 = "";
  try {
    csv2 = new TextDecoder("utf-8", { fatal: true }).decode(csvBuf);
  } catch {
    csv2 = new TextDecoder("gbk").decode(csvBuf);
  }
  combinedText += `\n--- 文件: 2026_2支付宝.csv ---\n` + csv2 + "\n";

  const lines = combinedText.split("\n");
  const batchLines = 50;
  const batch1 = lines.slice(0, batchLines).join("\n");

  console.log("Batch 1 input lines:", batchLines);
  console.log("Batch 1 input sample (first 500 chars):\n", batch1.substring(0, 500));

  const csvOutput = await callGeminiClean(batch1, apiKey, rules);
  console.log("\n=== Gemini output length:", csvOutput.length);
  console.log("\n=== Gemini output (full):\n", csvOutput);

  fs.writeFileSync("/Users/kay.zhong/Claude/bill-app/debug-gemini-output.csv", csvOutput, "utf-8");
  console.log("\nSaved to debug-gemini-output.csv");

  const parsed = Papa.parse<CsvRow>(csvOutput, { header: true, skipEmptyLines: true });
  console.log("\n=== PapaParse result:");
  console.log("Headers:", parsed.meta.fields);
  console.log("Row count:", parsed.data.length);
  console.log("First 3 rows:", JSON.stringify(parsed.data.slice(0, 3), null, 2));

  const sampleRow = parsed.data[0];
  if (sampleRow) {
    console.log("\n=== Sample row keys:", Object.keys(sampleRow));
    console.log("交易时间:", sampleRow["交易时间"]);
    console.log("收支/收支类型:", sampleRow["收支"], sampleRow["收支类型"]);
    console.log("金额:", sampleRow["金额"]);
    console.log("金额_净值:", sampleRow["金额_净值"]);
  }
}

debug().catch(console.error);
