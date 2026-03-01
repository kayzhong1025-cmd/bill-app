const fs = require('fs');
const Papa = require('papaparse');
const XLSX = require('xlsx');

// Read Alipay CSV
let alipayCsv = '';
try {
  const buffer = fs.readFileSync('/Users/kay.zhong/Desktop/AI/Bill App/原始账单文件/2026_2支付宝.csv');
  const decoder = new TextDecoder('gbk');
  alipayCsv = decoder.decode(buffer);
} catch (e) {
  console.log("Alipay CSV read error:", e.message);
}

// Read WeChat XLSX
let wechatCsv = '';
try {
  const workbook = XLSX.readFile('/Users/kay.zhong/Desktop/AI/Bill App/原始账单文件/2026_2微信.xlsx');
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  wechatCsv = XLSX.utils.sheet_to_csv(worksheet, { forceQuotes: true });
} catch (e) {
  console.log("WeChat XLSX read error:", e.message);
}

const combinedText = `\n--- 文件: 2026_2微信.xlsx ---\n${wechatCsv}\n\n--- 文件: 2026_2支付宝.csv ---\n${alipayCsv}\n`;

function extractExactStats(rawText) {
  let totalExpense = 0;
  let totalIncome = 0;
  let estimatedCount = 0;
  
  const lines = rawText.split("\n");
  
  let headerFound = false;
  // 1. 尝试从微信/支付宝的头部提取（如果存在）
  for (const line of lines) {
    const m1 = line.match(/共\s*(\d+)\s*笔/);
    if (m1) { estimatedCount += parseInt(m1[1], 10); headerFound = true; }
    
    const m2 = line.match(/(?:支出|已支出)[：:]\s*\d+\s*笔\s*[,，]?\s*([\d.,]+)\s*元?/);
    if (m2) { totalExpense += parseFloat(m2[1].replace(/,/g, "")); headerFound = true; }
    
    const m3 = line.match(/(?:收入|已收入)[：:]\s*\d+\s*笔\s*[,，]?\s*([\d.,]+)\s*元?/);
    if (m3) { totalIncome += parseFloat(m3[1].replace(/,/g, "")); headerFound = true; }
  }

  // 2. 如果没有找到头部统计，尝试作为 CSV 解析
  if (!headerFound) {
    // ... fallback logic
  }
  
  return { totalExpense, totalIncome, estimatedCount };
}

console.log("=== Stats Result ===");
console.log(extractExactStats(combinedText));

