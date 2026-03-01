const Papa = require("papaparse");

const csvText = `交易时间,精细分类,收支,金额,金额_净值,交易对方,商品说明,来源,必要性打标,备注
2026-02-01 10:00:00,餐饮美食,支出,100,100,商家A,午餐,微信,日常支出,
2026-02-02 10:00:00,金融理财,不计收支,500,500,余额宝,转入,微信,日常支出,
2026-02-03 10:00:00,退款,收入,50,-50,商家A,退款,微信,日常支出,
`;

function normalizeDate(input) {
  if (!input) return null;
  const head = input.split(" ")[0].replaceAll("年", "-").replaceAll("月", "-").replaceAll("日", "").replaceAll("/", "-");
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

const cleanAmount = (val) => Number.parseFloat(val.replace(/[¥,]/g, ''));

const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

let validCount = 0;
let invalidCount = 0;

for (const row of parsed.data) {
  const typeText = (row["收支类型"] ?? row["收支"])?.trim();
  let parsedAmt = null;
  
  if (typeText && typeText !== "收入" && typeText !== "支出" && typeText !== "不计收支") {
    // null
  } else if (typeText === "不计收支") {
    const raw = row["金额"] || row["金额_净值"] || "0";
    const amount = Math.abs(cleanAmount(raw));
    if (Number.isFinite(amount) && amount !== 0) {
      parsedAmt = { amount, type: "transfer" };
    }
  } else {
    const netRaw = row["金额_净值"];
    if (netRaw !== undefined && netRaw.trim() !== "") {
      const netValue = cleanAmount(netRaw);
      if (!Number.isNaN(netValue) && netValue !== 0) {
        parsedAmt = {
          amount: Math.abs(netValue),
          type: netValue > 0 ? "expense" : "income",
        };
      }
    }
    
    if (!parsedAmt) {
      const raw = row["金额"] || "0";
      const amount = Math.abs(cleanAmount(raw));
      if (Number.isFinite(amount) && amount !== 0) {
        if (typeText === "收入") parsedAmt = { amount, type: "income" };
        if (typeText === "支出") parsedAmt = { amount, type: "expense" };
      }
    }
  }

  const date = normalizeDate(row["交易时间"] ?? row["日期"]);
  if (!date || !parsedAmt) {
      console.log("Failed date or parsedAmt", row);
      invalidCount++;
      continue;
  }

  let { amount, type } = parsedAmt;
  const category = (row["精细分类"] ?? row["审计分类"])?.trim() || "未分类";

  if (type === "income" && !(category === "年度总收入" || category === "兼职收入" || category === "其他收入" || category.includes("收入"))) {
    type = "expense";
    amount = -amount; // <--- This makes amount negative!
  }

  const descRaw = (row["商品说明"] ?? row["备注"] ?? row["交易对方"])?.trim() || "无说明";
  const description = descRaw.substring(0, 80);
  const hash = `${date.dateStr}_${type}_${amount}_${description}`;

  const isValid = (
    typeof hash === "string" &&
    hash.length > 0 &&
    (type === "income" || type === "expense" || type === "transfer") &&
    typeof date.dateStr === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(date.dateStr) &&
    typeof amount === "number" &&
    Number.isFinite(amount) &&
    amount !== 0 // <--- This checks if amount !== 0
  );

  if (isValid) {
      validCount++;
  } else {
      console.log("Invalid record:", { hash, type, amount, dateStr: date.dateStr });
      invalidCount++;
  }
}

console.log("Valid:", validCount, "Invalid:", invalidCount);

