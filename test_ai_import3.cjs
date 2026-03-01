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
    // 只有年度总收入和兼职收入算作真正的收入，其他的收入算作退款（负支出）
    if (category === "年度总收入" || category === "兼职收入") {
      totalIncome += amount;
    } else {
      totalExpense -= amount;
    }
  } else if (type === "不计收支") {
    // 不计收支通常不计入总支出和总收入，除非有特殊规则
    // Let's see what happens if we ignore them completely
  }
}

console.log("Adjusted Total Expense:", totalExpense);
console.log("Adjusted Total Income:", totalIncome);
