const fs = require('fs');
const text = fs.readFileSync("/Users/kay.zhong/Desktop/AI/Bill App/2025年度财务审计对账单_纯净版.csv", "utf-8");
const lines = text.split("\n");

let droppedIncomes = 0;
let ignoreCount = 0;

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  const parts = line.split(",");
  const type = parts[2];
  const category = parts[1];
  
  if (type === "不计收支") {
    ignoreCount++;
  }
  
  if (type === "收入" && category !== "年度总收入" && category !== "兼职收入") {
    droppedIncomes++;
  }
}

console.log("Ignore count:", ignoreCount);
console.log("Dropped incomes:", droppedIncomes);
