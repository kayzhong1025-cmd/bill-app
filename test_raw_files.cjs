const fs = require('fs');
const Papa = require('papaparse');
const XLSX = require('xlsx');

function extractExactStats(rawText) {
  let totalExpense = 0;
  let totalIncome = 0;
  let estimatedCount = 0;
  
  const lines = rawText.split("\n");
  
  // 1. Try to extract from WeChat/Alipay headers
  for (const line of lines) {
    const m1 = line.match(/共\s*(\d+)\s*笔/);
    if (m1) estimatedCount = Math.max(estimatedCount, parseInt(m1[1], 10));
    const m2 = line.match(/(?:支出|已支出)[：:]\s*(\d+)\s*笔\s*[,，]?\s*([\d.,]+)\s*元?/);
    if (m2) totalExpense = parseFloat(m2[2].replace(/,/g, "")) || totalExpense;
    const m3 = line.match(/(?:收入|已收入)[：:]\s*(\d+)\s*笔\s*[,，]?\s*([\d.,]+)\s*元?/);
    if (m3) totalIncome = parseFloat(m3[2].replace(/,/g, "")) || totalIncome;
  }

  // 2. If headers not found, try to parse as CSV
  if (totalExpense === 0 && totalIncome === 0) {
    const headerIndex = lines.findIndex(l => l.includes('金额') && (l.includes('收支') || l.includes('收/支') || l.includes('交易类型')));
    if (headerIndex !== -1) {
      const csvText = lines.slice(headerIndex).join('\n');
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      if (parsed.data && parsed.data.length > 0) {
        let validRows = 0;
        for (const row of parsed.data) {
          const typeStr = row['收支'] || row['收/支'] || row['交易类型'] || '';
          const amountStr = row['金额_净值'] || row['金额(元)'] || row['金额'] || '0';
          const amount = Math.abs(parseFloat(amountStr.replace(/¥|,/g, '')));
          if (isNaN(amount) || amount === 0) continue;
          
          validRows++;
          if (typeStr.includes('支出')) {
            totalExpense += amount;
          } else if (typeStr.includes('收入')) {
            totalIncome += amount;
          }
        }
        estimatedCount = validRows;
      }
    } 
    
    if (estimatedCount === 0) {
      for (const line of lines) {
        if (line.includes('支出') || line.includes('收入')) {
          const parts = line.split(',');
          let amount = 0;
          let type = '';
          
          for (let i = 0; i < parts.length; i++) {
            if (parts[i] === '支出' || parts[i] === '收入') {
              type = parts[i];
              if (i + 1 < parts.length) {
                const parsedAmount = parseFloat(parts[i + 1].replace(/¥|,/g, ''));
                if (!isNaN(parsedAmount)) {
                  amount = Math.abs(parsedAmount);
                  break;
                }
              }
            }
          }
          
          if (amount > 0) {
            estimatedCount++;
            if (type === '支出') totalExpense += amount;
            if (type === '收入') totalIncome += amount;
          }
        }
      }
    }
  }
  
  return { totalExpense, totalIncome, estimatedCount };
}

// Read Alipay CSV
let alipayCsv = '';
try {
  alipayCsv = fs.readFileSync('/Users/kay.zhong/Desktop/AI/Bill App/原始账单文件/2026_2支付宝.csv', 'utf-8');
  // Try GBK if UTF-8 fails or looks weird
  if (alipayCsv.includes('')) {
    const buffer = fs.readFileSync('/Users/kay.zhong/Desktop/AI/Bill App/原始账单文件/2026_2支付宝.csv');
    const decoder = new TextDecoder('gbk');
    alipayCsv = decoder.decode(buffer);
  }
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

console.log("=== Combined Text Sample ===");
console.log(combinedText.substring(0, 500) + "\n...\n");

console.log("=== Stats Result ===");
console.log(extractExactStats(combinedText));

