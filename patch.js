const fs = require('fs');
const path = './src/lib/aiImport.ts';

let content = fs.readFileSync(path, 'utf-8');

// Add debug logging to processBatch
content = content.replace(
  /const csvCheck = validateParsedCsv\(parsed\);/g,
  `console.log(\`[Debug] 批次 \${index + 1} AI 返回原始文本:\`, csvText);
    console.log(\`[Debug] 批次 \${index + 1} 解析后数据:\`, parsed.data);
    const csvCheck = validateParsedCsv(parsed);`
);

content = content.replace(
  /const records = rowsToRecords\(parsed\.data, documentId\)\.filter\(isValidBillRecord\);/g,
  `const rawRecords = rowsToRecords(parsed.data, documentId);
    console.log(\`[Debug] 批次 \${index + 1} 转换后未过滤记录:\`, rawRecords);
    const records = rawRecords.filter(isValidBillRecord);
    console.log(\`[Debug] 批次 \${index + 1} 过滤后有效记录:\`, records);`
);

fs.writeFileSync(path, content);
