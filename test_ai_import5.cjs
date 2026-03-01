const fs = require('fs');
const text = fs.readFileSync("/Users/kay.zhong/Desktop/AI/Bill App/2025年度财务审计对账单_纯净版.csv", "utf-8");

const lines = text.split("\n");
let totalExpense = 0;
let totalIncome = 0;

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  const parts = line.split(",");
  const type = parts[2];
  const category = parts[1];
  const amount = parseFloat(parts[3]);
  const netAmount = parseFloat(parts[4]);
  
  if (type === "支出") {
    totalExpense += amount;
  } else if (type === "收入") {
    totalIncome += amount;
  } else if (type === "不计收支") {
    if (netAmount > 0) {
      totalExpense += netAmount;
    } else {
      totalIncome += Math.abs(netAmount);
    }
  }
}

console.log("Raw Total Expense (with 不计收支):", totalExpense);
console.log("Raw Total Income (with 不计收支):", totalIncome);
