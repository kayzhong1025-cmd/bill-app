const fs = require('fs');
const text = fs.readFileSync("/Users/kay.zhong/Desktop/AI/Bill App/2025年度财务审计对账单_纯净版.csv", "utf-8");

const lines = text.split("\n");
let expenseCount = 0;
let incomeCount = 0;
let ignoreCount = 0;

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  const parts = line.split(",");
  const type = parts[2];
  const category = parts[1];
  
  if (type === "支出") expenseCount++;
  if (type === "收入") incomeCount++;
  if (type === "不计收支") ignoreCount++;
}

console.log("支出 count:", expenseCount);
console.log("收入 count:", incomeCount);
console.log("不计收支 count:", ignoreCount);
