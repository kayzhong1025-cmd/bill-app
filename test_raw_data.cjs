const fs = require('fs');
const Papa = require('papaparse');

// Simulate raw data with header in the middle
const rawText = `微信支付账单明细,,,,,,,,
微信昵称：[User],,,,,,,,
起始时间：[2026-01-01 00:00:00] 终止时间：[2026-01-31 23:59:59],,,,,,,,
导出类型：[全部],,,,,,,,
导出时间：[2026-02-01 10:00:00],,,,,,,,
共 3 笔记录,,,,,,,,
已支出：2 笔，共 200.00 元,,,,,,,,
已收入：1 笔，共 100.00 元,,,,,,,,
,,,,,,,,
----------------------微信支付账单明细列表--------------------,,,,,,,,
交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注
2026-01-01 10:00:00,微信红包,张三,/,支出,¥100.00,零钱,支付成功,1000000000000000000000000000,1000000000000000000000000000,"/"
2026-01-02 11:00:00,扫二维码付款,李四,/,支出,¥100.00,零钱,支付成功,2000000000000000000000000000,2000000000000000000000000000,"/"
2026-01-03 12:00:00,微信转账,王五,/,收入,¥100.00,/,已存入零钱,3000000000000000000000000000,3000000000000000000000000000,"/"`;

function extractExactStats(rawText) {
  let totalExpense = 0;
  let totalIncome = 0;
  let estimatedCount = 0;
  
  const lines = rawText.split("\n");
  
  // 1. 尝试从微信/支付宝的头部提取（如果存在）
  for (const line of lines) {
    const m1 = line.match(/共\s*(\d+)\s*笔/);
    if (m1) estimatedCount = Math.max(estimatedCount, parseInt(m1[1], 10));
    const m2 = line.match(/(?:支出|已支出)[：:]\s*(\d+)\s*笔\s*[,，]?\s*([\d.,]+)\s*元?/);
    if (m2) totalExpense = parseFloat(m2[2].replace(/,/g, "")) || totalExpense;
    const m3 = line.match(/(?:收入|已收入)[：:]\s*(\d+)\s*笔\s*[,，]?\s*([\d.,]+)\s*元?/);
    if (m3) totalIncome = parseFloat(m3[2].replace(/,/g, "")) || totalIncome;
  }

  // 2. 如果没有找到头部统计，尝试作为 CSV 解析
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
          }
          // '不计收支' 不计入总支出/收入，以匹配 Ground Truth
        }
      }
    } else {
      // 尝试匹配原始账单中的单行数据
      for (const line of lines) {
        // 匹配类似：2026-01-05 09:53:45,交通出行,高德打车,...,支出,15.50,...
        if (line.includes('支出') || line.includes('收入')) {
          const parts = line.split(',');
          let amount = 0;
          let type = '';
          
          for (let i = 0; i < parts.length; i++) {
            if (parts[i] === '支出' || parts[i] === '收入') {
              type = parts[i];
              // 通常金额在收支类型的下一列
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
            // 不计收支不计入总支出/收入，以匹配 Ground Truth
          }
        }
      }
    }
  }
  
  return { totalExpense, totalIncome, estimatedCount };
}

console.log(extractExactStats(rawText));
