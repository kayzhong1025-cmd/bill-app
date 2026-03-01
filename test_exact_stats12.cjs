const fs = require("fs");
const Papa = require("papaparse");

const text = fs.readFileSync("/Users/kay.zhong/Desktop/AI/Bill App/2025年度财务审计对账单_纯净版.csv", "utf-8");

const lines = text.split("\n");
const headerIndex = lines.findIndex(l => l.includes('金额') && (l.includes('收支') || l.includes('收/支') || l.includes('交易类型')));

let expenses = [];
let incomes = [];

if (headerIndex !== -1) {
  const csvText = lines.slice(headerIndex).join('\n');
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  if (parsed.data && parsed.data.length > 0) {
    for (const row of parsed.data) {
      const typeStr = row['收支'] || row['收/支'] || row['交易类型'] || '';
      const amountStr = row['金额_净值'] || row['金额(元)'] || row['金额'] || '0';
      const rawAmount = parseFloat(amountStr.replace(/¥|,/g, ''));
      const amount = Math.abs(rawAmount);
      const category = (row['精细分类'] || row['审计分类'] || row['分类'] || row['交易分类'] || '未分类').trim();
      
      if (isNaN(amount) || amount === 0) continue;
      
      if (typeStr.includes('支出')) {
        expenses.push({amount, category});
      } else if (typeStr.includes('收入')) {
        incomes.push({amount, category});
      }
    }
  }
}

// 打印前10个最大的支出和收入，看看都是什么分类
console.log("Top 10 Expenses:");
expenses.sort((a,b) => b.amount - a.amount).slice(0, 10).forEach(e => console.log(e));

console.log("\nTop 10 Incomes:");
incomes.sort((a,b) => b.amount - a.amount).slice(0, 10).forEach(i => console.log(i));

