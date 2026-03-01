const fs = require("fs");
const Papa = require("papaparse");

const text = fs.readFileSync("/Users/kay.zhong/Desktop/AI/Bill App/2025年度财务审计对账单_纯净版.csv", "utf-8");

let csvTotalExpense = 0;
let csvTotalIncome = 0;

const lines = text.split("\n");
const headerIndex = lines.findIndex(l => l.includes('金额') && (l.includes('收支') || l.includes('收/支') || l.includes('交易类型')));

if (headerIndex !== -1) {
  const csvText = lines.slice(headerIndex).join('\n');
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  if (parsed.data && parsed.data.length > 0) {
    for (const row of parsed.data) {
      const typeStr = row['收支'] || row['收/支'] || row['交易类型'] || '';
      const amountStr = row['金额_净值'] || row['金额(元)'] || row['金额'] || '0';
      const amount = Math.abs(parseFloat(amountStr.replace(/¥|,/g, '')));
      const category = (row['精细分类'] || row['审计分类'] || row['分类'] || row['交易分类'] || '未分类').trim();
      
      if (isNaN(amount) || amount === 0) continue;
      
      if (typeStr.includes('支出')) {
        csvTotalExpense += amount;
      } else if (typeStr.includes('收入')) {
        if (category === "年度总收入" || category === "兼职收入" || category === "其他收入") {
          csvTotalIncome += amount;
        } else {
          // Treat other incomes as refunds (negative expense)
          csvTotalExpense -= amount;
        }
      }
    }
  }
}

console.log("csvTotalExpense:", csvTotalExpense);
console.log("csvTotalIncome:", csvTotalIncome);
