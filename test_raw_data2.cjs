const Papa = require('papaparse');
const rawText = `2026-01-05 20:31:59,文化休闲,App Store & Apple Music,tpa***@apple.com,App Store & Apple Music: 01.05购买,支出,19.00,招商银行信用卡(1113),交易成功,2026010522001427821413639334 ,MNOH0228B2a0 , ,
2026-01-05 09:53:45,交通出行,高德打车,aut***@autonavi.com,高德打车订单,支出,15.50,招商银行信用卡(1113),交易成功,2026010522001427821408793112 ,0003N202601050000000013877589581 , ,`;

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
