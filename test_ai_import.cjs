const fs = require('fs');
const text = fs.readFileSync("/Users/kay.zhong/Desktop/AI/Bill App/2025年度财务审计对账单_纯净版.csv", "utf-8");

let totalExpense = 0;
let totalIncome = 0;
let estimatedCount = 0;

const lines = text.split("\n");

let csvValidRows = 0;
let csvTotalExpense = 0;
let csvTotalIncome = 0;

const headerIndex = lines.findIndex(l => l.includes('金额') && (l.includes('收支') || l.includes('收/支') || l.includes('交易类型')));
if (headerIndex !== -1) {
  const csvText = lines.slice(headerIndex).join('\n');
  // Simple manual parsing since we don't have papaparse in this script
  const rows = csvText.split('\n').slice(1);
  for (const row of rows) {
    if (!row.trim()) continue;
    const parts = row.split(',');
    // 交易时间,精细分类,收支,金额,金额_净值,交易对方,商品说明,来源,必要性打标,备注
    // 0       1        2   3    4        5        6        7    8         9
    const typeStr = parts[2] || '';
    const amountStr = parts[4] || parts[3] || '0';
    const amount = Math.abs(parseFloat(amountStr.replace(/¥|,/g, '')));
    
    if (isNaN(amount) || amount === 0) continue;
    
    csvValidRows++;
    let isExp = false;
    let isInc = false;
    if (typeStr.includes('支出')) {
      csvTotalExpense += amount;
      isExp = true;
    } else if (typeStr.includes('收入')) {
      if (parts[1] === "年度总收入" || parts[1] === "兼职收入") {
        csvTotalIncome += amount;
        isInc = true;
      } else {
        csvTotalExpense -= amount;
        isExp = true;
      }
    } else if (typeStr.includes('不计收支')) {
      const netRaw = parts[4];
      if (netRaw !== undefined && netRaw.trim() !== "") {
        const netValue = parseFloat(netRaw);
        if (!isNaN(netValue) && netValue !== 0) {
          if (netValue > 0) {
             isExp = true;
             // csvTotalExpense += Math.abs(netValue);
          } else {
             isInc = true;
             // csvTotalIncome += Math.abs(netValue);
          }
        }
      }
    }
  }
}

console.log("Valid Rows:", csvValidRows);
console.log("Total Expense:", csvTotalExpense);
console.log("Total Income:", csvTotalIncome);
