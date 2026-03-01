function isValidBillRecord(r) {
  if (!r || typeof r !== "object") return false;
  const o = r;
  return (
    typeof o.hash === "string" &&
    o.hash.length > 0 &&
    (o.type === "income" || o.type === "expense" || o.type === "transfer") &&
    typeof o.dateStr === "string" &&
    /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(o.dateStr) &&
    typeof o.amount === "number" &&
    Number.isFinite(o.amount) &&
    o.amount !== 0
  );
}

console.log(isValidBillRecord({
    hash: "test",
    type: "expense",
    dateStr: "2026/02/01",
    amount: 100
}));
console.log(isValidBillRecord({
    hash: "test",
    type: "expense",
    dateStr: "2026-02-01",
    amount: 100
}));
