function normalizeDate(input) {
  if (!input) return null;
  const head = input.split(" ")[0].replaceAll("年", "-").replaceAll("月", "-").replaceAll("日", "");
  const parts = head.split("-").filter(Boolean);
  if (parts.length < 3) return null;
  const [year, month, day] = parts;
  return {
    dateStr: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
    year,
    month: month.padStart(2, "0"),
    day: day.padStart(2, "0"),
  };
}

console.log(normalizeDate("2026/02/01 10:00:00"));
console.log(normalizeDate("2026-02-01 10:00:00"));
