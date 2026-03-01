import { generateDataSummary } from './src/lib/aiImport';
import * as fs from 'fs';

async function run() {
  const content = fs.readFileSync('/Users/kay.zhong/Desktop/AI/Bill App/2026年01月财务审计对账单_最终版.csv', 'utf-8');
  // Use a dummy API key, it will fail the network request but we can see if fallback works, 
  // or we can just mock fetch.
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      candidates: [{
        content: {
          parts: [{
            text: '{"qualityRating":"可用","summaryText":"test"}'
          }]
        }
      }]
    })
  }) as any;

  const summary = await generateDataSummary(content, 'dummy');
  console.log(summary);
}
run();
