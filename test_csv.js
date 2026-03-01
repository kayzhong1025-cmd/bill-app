"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = __importDefault(require("fs"));
var csv_1 = require("./src/lib/csv");
var aiImport_1 = require("./src/lib/aiImport");
var text = fs_1.default.readFileSync("/Users/kay.zhong/Desktop/AI/Bill App/2025年度财务审计对账单_纯净版.csv", "utf-8");
var stats = (0, aiImport_1.extractExactStats)(text);
console.log("Exact Stats:", stats);
var lines = text.split("\n");
var headerIndex = lines.findIndex(function (l) { return l.includes('金额') && (l.includes('收支') || l.includes('收/支') || l.includes('交易类型')); });
var csvText = lines.slice(headerIndex).join('\n');
var parsed = (0, csv_1.parseCsvText)(csvText);
var records = (0, csv_1.rowsToRecords)(parsed.data, "test-id");
console.log("Parsed Records Count:", records.length);
var expenses = records.filter(function (r) { return r.type === "expense"; });
var incomes = records.filter(function (r) { return r.type === "income"; });
console.log("Expenses count:", expenses.length, "Total:", expenses.reduce(function (s, r) { return s + r.amount; }, 0));
console.log("Incomes count:", incomes.length, "Total:", incomes.reduce(function (s, r) { return s + r.amount; }, 0));
// Check how many have amount <= 0
console.log("Negative/Zero amounts:", records.filter(function (r) { return r.amount <= 0; }).length);
