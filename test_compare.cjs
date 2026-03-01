const fs = require('fs');
const Papa = require('papaparse');
const { execSync } = require('child_process');

// 1. Read the final CSV
const finalCsvPath = '/Users/kay.zhong/Desktop/AI/Bill App/2026年01月财务审计对账单_最终版.csv';
const finalContent = fs.readFileSync(finalCsvPath, 'utf-8');
const finalParsed = Papa.parse(finalContent, { header: true, skipEmptyLines: true });

let finalExpense = 0;
let finalIncome = 0;
let finalCount = 0;

for (const row of finalParsed.data) {
  const typeStr = row['收支'] || '';
  const amountStr = row['金额_净值'] || '0';
  const amount = Math.abs(parseFloat(amountStr.replace(/¥|,/g, '')));
  if (isNaN(amount)) continue;
  
  finalCount++;
  if (typeStr === '支出') finalExpense += amount;
  if (typeStr === '收入') finalIncome += amount;
  // Note: if type is '不计收支', we don't add to expense or income here to match standard logic, 
  // but let's see what the actual final CSV has.
}

console.log("=== 最终版数据 (Ground Truth) ===");
console.log(`总记录数: ${finalCount}`);
console.log(`总支出: ${finalExpense.toFixed(2)}`);
console.log(`总收入: ${finalIncome.toFixed(2)}`);

// 2. Read the raw text (I will simulate the raw text from the screenshot)
const rawText = `2026-01-05 20:31:59,文化休闲,App Store & Apple Music,tpa***@apple.com,App Store & Apple Music: 01.05购买,支出,19.00,招商银行信用卡(1113),交易成功,2026010522001427821413639334 ,MNOH0228B2a0 , ,
2026-01-05 09:53:45,交通出行,高德打车,aut***@autonavi.com,高德打车订单,支出,15.50,招商银行信用卡(1113),交易成功,2026010522001427821408793112 ,0003N202601050000000013877589581 , ,
2026-01-04 21:40:27,餐饮美食,盒马,shh***@163.com,盒马 低脂肪火腿片 50g*3等多件,支出,57.80,招商银行信用卡(1113),交易成功,2026010422001127821409408386 ,T200P3164464525839772092 , ,
2026-01-04 09:51:49,交通出行,高德打车,aut***@autonavi.com,高德打车订单,支出,12.49,招商银行信用卡(1113),交易成功,2026010422001427821407836408 ,0003N202601040000000013856238268 , ,`;

// 3. Test our extractExactStats function
function extractExactStats(rawText) {
  let totalExpense = 0;
  let totalIncome = 0;
  let estimatedCount = 0;
  
  const lines = rawText.split("\n");
  
  for (const line of lines) {
    const m1 = line.match(/共\s*(\d+)\s*笔/);
    if (m1) estimatedCount = Math.max(estimatedCount, parseInt(m1[1], 10));
    const m2 = line.match(/(?:支出|已支出)[：:]\s*(\d+)\s*笔\s*[,，]?\s*([\d.,]+)\s*元?/);
    if (m2) totalExpense = parseFloat(m2[2].replace(/,/g, "")) || totalExpense;
    const m3 = line.match(/(?:收入|已收入)[：:]\s*(\d+)\s*笔\s*[,，]?\s*([\d.,]+)\s*元?/);
    if (m3) totalIncome = parseFloat(m3[2].replace(/,/g, "")) || totalIncome;
  }

  if (totalExpense === 0 && totalIncome === 0) {
    const headerIndex = lines.findIndex(l => l.includes('金额') && (l.includes('收支') || l.includes('收/支') || l.includes('交易类型')));
    if (headerIndex !== -1) {
      const csvText = lines.slice(headerIndex).join('\n');
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      if (parsed.data && parsed.data.length > 0) {
        estimatedCount = parsed.data.length;
        for (const row of parsed.data) {
          const typeStr = row['收支'] || row['收/支'] || row['交易类型'] || '';
          const amountStr = row['金额_净值'] || row['金额(元)'] || row['金额'] || '0';
          const amount = Math.abs(parseFloat(amountStr.replace(/¥|,/g, '')));
          if (isNaN(amount)) continue;
          
          if (typeStr.includes('支出')) {
            totalExpense += amount;
          } else if (typeStr.includes('收入')) {
            totalIncome += amount;
          } else if (typeStr === '不计收支') {
            totalExpense += amount;
          }
        }
      }
    } else {
      for (const line of lines) {
        if (line.includes('支出') || line.includes('收入')) {
          const parts = line.split(',');
          let amount = 0;
          let type = '';
          
          for (let i = 0; i < parts.length; i++) {
            if (parts[i] === '支出' || parts[i] === '收入') {
              type = parts[i];
              if (i + 1 < parts.length) {
                const parsedAmount = parseFloat(parts[i + 1].replace(/¥|,/g, ''));
                if (!isNaN(parsedAmount)) {
                  amount = Math.abs(parsedAmount);
                  break;
                }
              }
            }
          }
          
          if (amount > 0) {
            estimatedCount++;
            if (type === '支出') totalExpense += amount;
            if (type === '收入') totalIncome += amount;
          }
        }
      }
    }
  }
  
  return { totalExpense, totalIncome, estimatedCount };
}

console.log("\n=== 提取算法测试结果 ===");
const result = extractExactStats(finalContent); // Test with final content first
console.log("用最终版测试提取算法:", result);

