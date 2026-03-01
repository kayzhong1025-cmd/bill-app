const fs = require('fs');
const Papa = require('papaparse');
const crypto = require('crypto');

// Copy logic from csv.ts roughly
function normalizeDate(dateStr) {
  if (!dateStr) return "";
  let clean = dateStr.trim().replace(/\s+/, " ");
  // 如果是形如 "2026/02/01 08:30:00" 的格式，截取前段并把斜杠替换为横线
  const spaceIndex = clean.indexOf(" ");
  if (spaceIndex !== -1) {
    clean = clean.substring(0, spaceIndex);
  }
  clean = clean.replaceAll("/", "-");
  return clean;
}

const cleanAmount = (val) => Number.parseFloat(val.replace(/[¥,]/g, ''));

function parseAmountAndType(row) {
  const typeText = (row["收支类型"] ?? row["收支"])?.trim();
  if (typeText && typeText !== "收入" && typeText !== "支出" && typeText !== "不计收支") {
    return null;
  }

  if (typeText === "不计收支") {
    const raw = row["金额"] || row["金额_净值"] || "0";
    const amount = Math.abs(cleanAmount(raw));
    if (!Number.isFinite(amount) || amount === 0) return null;
    return { amount, type: "transfer" };
  }

  const netRaw = row["金额_净值"];
  if (netRaw !== undefined && netRaw.trim() !== "") {
    const netValue = cleanAmount(netRaw);
    if (!Number.isNaN(netValue) && netValue !== 0) {
      return {
        amount: Math.abs(netValue),
        type: netValue > 0 ? "expense" : "income",
      };
    }
  }
  const raw = row["金额"] || "0";
  const amount = Math.abs(cleanAmount(raw));
  if (!Number.isFinite(amount) || amount === 0) return null;

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
    /^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/.test(o.dateStr) &&
    typeof o.amount === "number" &&
    Number.isFinite(o.amount) &&
    o.amount !== 0
  );
}


function parseCsv(filePath) {
    const text = fs.readFileSync(filePath, 'utf-8');
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    
    console.log("Total parsed rows:", parsed.data.length);
    if (parsed.data.length > 0) {
        console.log("First row keys:", Object.keys(parsed.data[0]));
    }

    const records = parsed.data.map(row => {
        const parsedAmt = parseAmountAndType(row);
        const date = normalizeDate(row["交易时间"] ?? row["日期"]);
        
        if (!date || !parsedAmt) {
            // console.log("Skipped due to date/amt:", row);
            return null;
        }
        
        let { amount, type } = parsedAmt;
        const category = (row["精细分类"] ?? row["审计分类"])?.trim() || "未分类";
        
        if (type === "income" && !(category === "年度总收入" || category === "兼职收入" || category === "其他收入" || category.includes("收入"))) {
            type = "expense";
            amount = -amount;
        }
        
        const description = (row["商品"] ?? row["说明"] ?? row["备注"])?.trim() || "无说明";
        const target = (row["交易对方"] ?? row["对方"])?.trim() || "未知";
        
        const r = {
            id: "test",
            dateStr: date,
            amount: amount,
            type: type,
            category: category,
            target: target,
            description: description,
            originalRow: row,
            hash: "testhash",
            createdAt: Date.now()
        };
        
        if (!isValidBillRecord(r)) {
            console.log("Failed validation!", JSON.stringify(r));
            return null;
        }
        return r;
    }).filter(Boolean);
    
    console.log("Valid records:", records.length);
    if (records.length === 0) {
        console.log("First row values:", Object.values(parsed.data[0] || {}));
    }
}

parseCsv('/Users/kay.zhong/Desktop/AI/Bill App/原始账单文件/2026_2支付宝.csv');
