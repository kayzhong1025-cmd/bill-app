const fs = require('fs');
const text = fs.readFileSync("/Users/kay.zhong/Desktop/AI/Bill App/2025年度财务审计对账单_纯净版.csv", "utf-8");
const lines = text.split("\n");

let totalExpense = 0;
let totalIncome = 0;
let financialExpense = 0;

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  const parts = line.split(",");
  // 交易时间,精细分类,收支,金额,金额_净值,交易对方,商品说明,来源,必要性打标,备注
  // 0       1        2   3    4        5        6        7    8         9
  const category = parts[1];
  const type = parts[2];
  const amount = parseFloat(parts[3]);
  const netAmount = parseFloat(parts[4]);

  if (type === "支出") {
    totalExpense += amount;
  } else if (type === "收入") {
    totalIncome += amount;
  } else if (type === "不计收支") {
    // How is this handled?
    if (netAmount > 0) {
      totalExpense += netAmount;
      if (category === "金融理财") financialExpense += netAmount;
    } else {
      totalIncome += Math.abs(netAmount);
    }
  }
}

console.log("Total Expense:", totalExpense);
console.log("Total Income:", totalIncome);
console.log("Financial Expense (from 不计收支):", financialExpense);
