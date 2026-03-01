import type { BillRecord } from "../types/bill";

const GEMINI_MODEL = "gemini-2.5-flash";

/** 根据用户描述修正账单记录 */
export async function correctRecordsByInstruction(
  records: BillRecord[],
  instruction: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<BillRecord[]> {
  const url = `/api/gemini/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;

  const recordsJson = JSON.stringify(
    records.map((r) => ({
      hash: r.hash,
      type: r.type,
      dateStr: r.dateStr,
      year: r.year,
      month: r.month,
      day: r.day,
      category: r.category,
      amount: r.amount,
      counterparty: r.counterparty,
      description: r.description,
      source: r.source,
      necessity: r.necessity,
      remark: r.remark,
      documentId: r.documentId,
    })),
    null,
    0
  );

  const prompt = `你是个人财务助手。用户希望对以下账单记录进行修正。

【用户指令】${instruction}

【原始数据】JSON 数组，共 ${records.length} 条：
${recordsJson}

请严格按照用户指令修改记录，输出修正后的完整 JSON 数组。要求：
1. 输出纯 JSON 数组，不要任何解释
2. 数组长度必须与输入相同，顺序一致
3. 每条记录必须包含：hash, type, dateStr, year, month, day, category, amount, counterparty, description, source, necessity, remark
4. type 只能是 "income"、"expense" 或 "transfer"
5. amount 为非零数字（支出为正，退款为负）
6. 若某条不需修改，保持原样`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 65536,
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    }),
    signal,
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(errBody || `API 错误: ${res.status}`);
  }

  const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const cleaned = text.replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "").trim();
  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("AI 返回格式异常，无法解析");
  }

  let parsed: unknown[];
  try {
    parsed = JSON.parse(jsonMatch[0]) as unknown[];
  } catch {
    throw new Error("AI 返回 JSON 解析失败");
  }

  if (!Array.isArray(parsed) || parsed.length !== records.length) {
    throw new Error(`AI 返回条数不符，期望 ${records.length} 条`);
  }

  const result: BillRecord[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const raw = parsed[i];
    if (!raw || typeof raw !== "object") {
      result.push(records[i]);
      continue;
    }
    const o = raw as Record<string, unknown>;
    const type = o.type === "income" || o.type === "expense" || o.type === "transfer" ? o.type : records[i].type;
    const amount = typeof o.amount === "number" && o.amount !== 0 ? o.amount : records[i].amount;
    const description = typeof o.description === "string" ? o.description.substring(0, 80) : records[i].description;
    const hash = `${o.dateStr ?? records[i].dateStr}_${type}_${amount}_${description}`;

    result.push({
      hash,
      type,
      dateStr: String(o.dateStr ?? records[i].dateStr),
      year: String(o.year ?? records[i].year),
      month: String(o.month ?? records[i].month),
      day: String(o.day ?? records[i].day),
      category: String(o.category ?? records[i].category).trim() || "未分类",
      amount,
      counterparty: String(o.counterparty ?? records[i].counterparty).trim() || "-",
      description,
      source: String(o.source ?? records[i].source).trim() || "-",
      necessity: String(o.necessity ?? records[i].necessity).trim() || "未打标",
      remark: String(o.remark ?? records[i].remark).trim() || "",
      documentId: records[i].documentId,
    });
  }

  return result;
}
