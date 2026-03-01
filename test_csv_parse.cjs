const fs = require("fs");
const Papa = require("papaparse");

const text = fs.readFileSync("/Users/kay.zhong/Desktop/AI/Bill App/2025年度财务审计对账单_纯净版.csv", "utf-8");

const lines = text.split("\n");
const headerIndex = lines.findIndex(l => l.includes('金额') && (l.includes('收支') || l.includes('收/支') || l.includes('交易类型')));

if (headerIndex !== -1) {
  const csvText = lines.slice(headerIndex).join('\n');
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  
  if (parsed.data && parsed.data.length > 0) {
    console.log("Parsed rows:", parsed.data.length);
    console.log("First row:", parsed.data[0]);
    
    // Let's simulate rowsToRecords
    let parsedRecords = 0;
    let validRecords = 0;
    
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
      
      if (parsedAmt) parsedRecords++;
      
      if (parsedAmt) {
        const type = parsedAmt.type;
        if (type === "income" || type === "expense" || type === "transfer") {
            validRecords++;
        } else {
            console.log("Invalid type:", type);
        }
      }
    }
    
    console.log("Parsed amounts:", parsedRecords);
    console.log("Valid types:", validRecords);
  }
}
