const fs = require("fs");
const Papa = require("papaparse");

const text = fs.readFileSync("/Users/kay.zhong/Desktop/AI/Bill App/2025年度财务审计对账单_纯净版.csv", "utf-8");

let csvTotalExpense = 0;
let csvTotalIncome = 0;
let csvTotalIgnored = 0;

const lines = text.split("\n");
const headerIndex = lines.findIndex(l => l.includes('金额') && (l.includes('收支') || l.includes('收/支') || l.includes('交易类型')));

if (headerIndex !== -1) {
  const csvText = lines.slice(headerIndex).join('\n');
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  if (parsed.data && parsed.data.length > 0) {
    for (const row of parsed.data) {
      const typeStr = row['收支'] || row['收/支'] || row['交易类型'] || '';
      const amountStr = row['金额_净值'] || row['金额(元)'] || row['金额'] || '0';
      // 注意：这里之前是 Math.abs，现在我们看看原始值
      const rawAmount = parseFloat(amountStr.replace(/¥|,/g, ''));
      const amount = Math.abs(rawAmount);
      const category = (row['精细分类'] || row['审计分类'] || row['分类'] || row['交易分类'] || '未分类').trim();
      
      if (isNaN(amount) || amount === 0) continue;
      
      // 如果金额是负数，并且类型是支出，那它其实是退款（收入）
      // 如果金额是负数，并且类型是收入，那它其实是扣款（支出）
      let actualType = typeStr;
      if (rawAmount < 0) {
         if (typeStr.includes('支出')) actualType = '收入';
         else if (typeStr.includes('收入')) actualType = '支出';
      }

      if (actualType.includes('支出')) {
        csvTotalExpense += amount;
      } else if (actualType.includes('收入')) {
        csvTotalIncome += amount;
      } else if (actualType.includes('不计收支')) {
        csvTotalIgnored += amount;
      }
    }
  }
}

console.log("csvTotalExpense (with negative amount handling):", csvTotalExpense);
console.log("csvTotalIncome (with negative amount handling):", csvTotalIncome);
console.log("csvTotalIgnored (with negative amount handling):", csvTotalIgnored);
