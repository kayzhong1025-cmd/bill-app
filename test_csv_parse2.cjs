const fs = require("fs");
const Papa = require("papaparse");

const text = fs.readFileSync("/Users/kay.zhong/Desktop/AI/Bill App/2025年度财务审计对账单_纯净版.csv", "utf-8");

const lines = text.split("\n");
const headerIndex = lines.findIndex(l => l.includes('金额') && (l.includes('收支') || l.includes('收/支') || l.includes('交易类型')));

function normalizeDate(input) {
  if (!input) return null;
  const head = input.split(" ")[0].replaceAll("年", "-").replaceAll("月", "-").replaceAll("日", "");
  const parts = head.split("-").filter(Boolean);
  if (parts.length < 3) return null;
  const [year, month, day] = parts;
  return {
    dateStr: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
    year,
    month: month.padStart(2, "0"),
    day: day.padStart(2, "0"),
  };
}

if (headerIndex !== -1) {
  const csvText = lines.slice(headerIndex).join('\n');
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  
  if (parsed.data && parsed.data.length > 0) {
    let validRecords = 0;
    let invalidRecords = [];
    
    for (const row of parsed.data) {
      const typeText = (row["收支类型"] ?? row["收支"])?.trim();
      let parsedAmt = null;
      
      if (typeText && typeText !== "收入" && typeText !== "支出" && typeText !== "不计收支") {
        // null
      } else if (typeText === "不计收支") {
        const raw = row["金额"] || row["金额_净值"] || "0";
        const amount = Math.abs(Number.parseFloat(raw));
        if (Number.isFinite(amount) && amount !== 0) {
          parsedAmt = { amount, type: "transfer" };
        }
      } else {
        const netRaw = row["金额_净值"];
        if (netRaw !== undefined && netRaw.trim() !== "") {
          const netValue = Number.parseFloat(netRaw);
          if (!Number.isNaN(netValue) && netValue !== 0) {
            parsedAmt = {
              amount: Math.abs(netValue),
              type: netValue > 0 ? "expense" : "income",
            };
          }
        }
        
        if (!parsedAmt) {
          const raw = row["金额"] || "0";
          const amount = Math.abs(Number.parseFloat(raw));
          if (Number.isFinite(amount) && amount !== 0) {
            if (typeText === "收入") parsedAmt = { amount, type: "income" };
            if (typeText === "支出") parsedAmt = { amount, type: "expense" };
          }
        }
      }
      
      const date = normalizeDate(row["交易时间"] ?? row["日期"]);
      if (!date || !parsedAmt) continue;

      let { amount, type } = parsedAmt;
      const category = (row["精细分类"] ?? row["审计分类"])?.trim() || "未分类";

      if (type === "income" && !(category === "年度总收入" || category === "兼职收入" || category === "其他收入" || category.includes("收入"))) {
        type = "expense";
        amount = -amount;
      }
      
      const descRaw = (row["商品说明"] ?? row["备注"] ?? row["交易对方"])?.trim() || "无说明";
      const description = descRaw.substring(0, 80);
      const hash = `${date.dateStr}_${type}_${amount}_${description}`;

      // Simulate isValidBillRecord
      const isValid = (
        typeof hash === "string" &&
        hash.length > 0 &&
        (type === "income" || type === "expense" || type === "transfer") &&
        typeof date.dateStr === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(date.dateStr) &&
        typeof amount === "number" &&
        Number.isFinite(amount) &&
        amount > 0
      );
      
      if (isValid) {
          validRecords++;
      } else {
          invalidRecords.push({ hash, type, amount, dateStr: date.dateStr });
      }
    }
    
    console.log("Valid records:", validRecords);
    console.log("Invalid records count:", invalidRecords.length);
    if (invalidRecords.length > 0) {
        console.log("First 5 invalid:", invalidRecords.slice(0, 5));
    }
  }
}
