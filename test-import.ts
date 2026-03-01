import * as XLSX from "xlsx";
import fs from "fs";
import { processAIImport, generateDataSummary } from "./src/lib/aiImport.js";

const mockRules = {
  coreRules: [
    { id: "net_value", label: "净值优先原则", description: "创建金额_净值列。支出设为正数，收入设为负数。", enabled: true },
    { id: "aa_offset", label: "AA 账单对冲", description: "识别交易对方包含“群收款”或特定好友名，以及备注中包含“AA/饭钱/回款”的收入。将此类收入的分类标记为对应的消费类目（如餐饮美食），通过负数抵消支出，计算真实个人成本。", enabled: true },
    { id: "ssot_dedup", label: "SSOT 去重原则", description: "若电子流水（微信/支付宝）与手动账单（如鲨鱼记账）在同一天出现金额一致的记录，强制保留电子流水（因其包含原始商户名），删除手动记录。", enabled: true },
    { id: "noise_filter", label: "噪声过滤", description: "自动剔除“交易关闭”、“已退款”、“解冻成功”等非真实资金流动记录。", enabled: true },
  ],
  personalRules: [
    { id: "travel", category: "差旅旅游", keywords: ["神州租车", "机票", "酒店", "异地消费", "澳洲", "沈阳"], enabled: true },
    { id: "sports", category: "休闲运动", keywords: ["F45", "Hyrox", "拳击", "健身"], enabled: true },
    { id: "housing", category: "住房物业", keywords: ["郑有玲", "4300", "水费", "物业费"], enabled: true },
    { id: "transport", category: "交通通勤", keywords: ["高德打车", "保险费", "车险", "停车场"], enabled: true },
    { id: "part_time", category: "兼职收入", keywords: ["牛伟", "阿滕", "Artem"], enabled: true },
    { id: "overtime", category: "加班打标", keywords: ["交通通勤发生于 21:00 以后自动打标加班/深夜归家"], enabled: true },
  ]
};

async function test() {
  const apiKey = "AIzaSyB-3siaqFc1CDEGPmJVKFEXw-CeTFFHMZM"; // Default API key
  
  let combinedText = "";
  
  // Read Excel
  const excelBuf = fs.readFileSync("/Users/kay.zhong/Desktop/AI/Bill App/原始账单文件/2026_2微信.xlsx");
  const workbook = XLSX.read(excelBuf, { type: "buffer" });
  const csv1 = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]], { forceQuotes: true });
  combinedText += `\n--- 文件: 2026_2微信.xlsx ---\n` + csv1 + "\n";
  
  // Read CSV
  const csvBuf = fs.readFileSync("/Users/kay.zhong/Desktop/AI/Bill App/原始账单文件/2026_2支付宝.csv");
  let csv2 = "";
  try {
    csv2 = new TextDecoder('utf-8', { fatal: true }).decode(csvBuf);
  } catch (e) {
    csv2 = new TextDecoder('gbk').decode(csvBuf);
  }
  combinedText += `\n--- 文件: 2026_2支付宝.csv ---\n` + csv2 + "\n";
  
  console.log("Total text length:", combinedText.length);
  console.log("Sample text (first 300 chars):\n", combinedText.substring(0, 300));
  
  try {
    console.log("\n1. Generating Summary...");
    const summary = await generateDataSummary(combinedText, apiKey);
    console.log("Summary:", summary);

    console.log("\n2. Processing Import...");
    const records = await processAIImport(
      combinedText,
      apiKey,
      mockRules,
      (current, total) => console.log(`Progress: ${current}/${total}`)
    );
    console.log(`Parsed ${records.length} records.`);
    console.log("First 3 records:", records.slice(0, 3));
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
