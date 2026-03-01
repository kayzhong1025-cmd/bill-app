import * as fs from 'fs';
import Papa from 'papaparse';

function extractExactStats(rawText: string) {
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
        estimatedCount = parsed.data.length;
        for (const row of parsed.data as any[]) {
          const typeStr = row['收支'] || row['收/支'] || row['交易类型'] || '';
          const amountStr = row['金额_净值'] || row['金额(元)'] || row['金额'] || '0';
          const amount = Math.abs(parseFloat(amountStr.replace(/¥|,/g, '')));
          if (isNaN(amount)) continue;
          
          if (typeStr.includes('支出')) {
            totalExpense += amount;
          } else if (typeStr.includes('收入')) {
            totalIncome += amount;
          } else if (typeStr === '不计收支') {
            totalExpense += amount;
          }
        }
      }
    }
  }
  
  return { totalExpense, totalIncome, estimatedCount };
}

const content = fs.readFileSync('/Users/kay.zhong/Desktop/AI/Bill App/2026年01月财务审计对账单_最终版.csv', 'utf-8');
console.log(extractExactStats(content));
