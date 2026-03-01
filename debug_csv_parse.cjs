const fs = require('fs');
const Papa = require('papaparse');

// Helper to clean amount strings
const cleanAmount = (val) => {
  if (typeof val !== 'string') return Number.parseFloat(val);
  return Number.parseFloat(val.replace(/[¥,]/g, ''));
};

function normalizeDate(input) {
  if (!input) return null;
  const partsArray = input.trim().split(/\s+/);
  const head = partsArray[0].replaceAll("年", "-").replaceAll("月", "-").replaceAll("日", "").replaceAll("/", "-");
  const timeStr = partsArray[1] || "";
  const parts = head.split("-").filter(Boolean);
  if (parts.length < 3) return null;
  const [year, month, day] = parts;
  return {
    dateStr: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
    timeStr,
    year,
    month: month.padStart(2, "0"),
    day: day.padStart(2, "0"),
  };
}

function parseAmountAndType(row) {
  const typeText = (row["收支类型"] ?? row["收支"])?.trim();
  if (typeText && typeText !== "收入" && typeText !== "支出" && typeText !== "不计收支") {
    return null;
  }

  if (typeText === "不计收支") {
    const raw = row["金额"] || row["金额_净值"] || "0";
    const amount = Math.abs(cleanAmount(raw));
    if (!Number.isFinite(amount)) return null; // Removed amount === 0 check
    return { amount, type: "transfer" };
  }

  const netRaw = row["金额_净值"];
  if (netRaw !== undefined && netRaw.trim() !== "") {
    const netValue = cleanAmount(netRaw);
    if (!Number.isNaN(netValue)) {
      return {
        amount: Math.abs(netValue),
        type: netValue > 0 ? "expense" : netValue < 0 ? "income" : "expense", // default to expense if exactly 0
      };
    }
  }
  const raw = row["金额"] || "0";
  const amount = Math.abs(cleanAmount(raw));
  if (!Number.isFinite(amount)) return null;

  if (typeText === "收入") return { amount, type: "income" };
  if (typeText === "支出") return { amount, type: "expense" };

  return null;
}

function isValidBillRecord(r) {
  if (!r || typeof r !== "object") return false;
  const o = r;
  return (
    typeof o.hash === "string" &&
    o.hash.length > 0 &&
    (o.type === "income" || o.type === "expense" || o.type === "transfer") &&
    typeof o.dateStr === "string" &&
    /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(o.dateStr) &&
    typeof o.amount === "number" &&
    Number.isFinite(o.amount)
  );
}

function processCsv(csvContent) {
  const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
  console.log("Parsed AI output rows:", parsed.data.length);
  
  if (parsed.data.length > 0) {
      console.log("AI Output Headers:", Object.keys(parsed.data[0]));
      console.log("First AI Output Row:", parsed.data[0]);
  }

  let invalidReasons = [];

  const records = parsed.data.map((row, i) => {
    const parsedAmt = parseAmountAndType(row);
    const date = normalizeDate(row["交易时间"] ?? row["日期"]);
    
    if (!date) {
        invalidReasons.push(`Row ${i}: Invalid date (${row["交易时间"] ?? row["日期"]})`);
        return null;
    }
    if (!parsedAmt) {
        invalidReasons.push(`Row ${i}: Invalid amount/type (收支:${row["收支"]}, 金额:${row["金额"]}, 净值:${row["金额_净值"]})`);
        return null;
    }

    let { amount, type } = parsedAmt;
    const category = (row["精细分类"] ?? row["审计分类"])?.trim() || "未分类";

    if (type === "income" && !(category === "年度总收入" || category === "兼职收入" || category === "其他收入" || category.includes("收入"))) {
      type = "expense";
      amount = -amount;
    }
    const descRaw = (row["商品说明"] ?? row["备注"] ?? row["交易对方"])?.trim() || "无说明";
    const description = descRaw.substring(0, 80);
    const hash = `${date.dateStr}_${type}_${amount}_${description}`;

    const r = {
        hash,
        type,
        dateStr: date.dateStr,
        amount
    };

    if (!isValidBillRecord(r)) {
        invalidReasons.push(`Row ${i}: Failed final validation. Record: ${JSON.stringify(r)}`);
        return null;
    }
    return r;
  }).filter(Boolean);

  console.log("Valid records produced:", records.length);
  if (records.length === 0 && parsed.data.length > 0) {
      console.log("Top 5 invalid reasons:");
      console.log(invalidReasons.slice(0, 5).join('\n'));
  }
}

// Simulate AI output based on our prompt rules
const simulatedAiOutput = `交易时间,精细分类,收支,金额,金额_净值,交易对方,商品说明,来源,必要性打标,备注
2026-02-01 11:01:26,交通通勤,支出,15.73,15.73,高德打车,高德打车订单,支付宝,生存刚需,
2026-02-01 12:27:50,交通通勤,支出,9.9,9.9,高德打车,高德打车订单,支付宝,生存刚需,
`;

processCsv(simulatedAiOutput);

