import fs from 'fs';
import { processAIImport, generateDataSummary } from './src/lib/aiImport';

const raw = fs.readFileSync('/Users/kay.zhong/Desktop/AI/Bill App/原始账单文件/2026_2微信.xlsx', 'utf-8'); // wait it's xlsx, maybe I can't read it easily.
