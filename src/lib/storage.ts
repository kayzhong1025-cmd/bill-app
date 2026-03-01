import localforage from "localforage";
import type { BillRecord, ThemeMode, DocumentMeta } from "../types/bill";

const store = localforage.createInstance({
  name: "bill-dashboard",
  storeName: "dashboard_store",
});

/**
 * 数据迁移层：把从 IndexedDB 读出来的原始对象规范化为当前 BillRecord 类型。
 * 每次向 BillRecord 新增字段时，在此处补一行默认值即可，旧数据无需重新导入。
 */
function migrateRecord(raw: Record<string, unknown>): BillRecord {
  return {
    hash:         typeof raw.hash === "string" ? raw.hash : "",
    type:         (raw.type === "income" || raw.type === "expense") ? raw.type : "expense",
    dateStr:      typeof raw.dateStr === "string" ? raw.dateStr : "",
    year:         typeof raw.year === "string" ? raw.year : "",
    month:        typeof raw.month === "string" ? raw.month : "",
    day:          typeof raw.day === "string" ? raw.day : "",
    category:     typeof raw.category === "string" ? raw.category : "其他",
    amount:       (typeof raw.amount === "number" && isFinite(raw.amount)) ? raw.amount : 0,
    counterparty: typeof raw.counterparty === "string" ? raw.counterparty : "",
    description:  typeof raw.description === "string" ? raw.description : "",
    source:       typeof raw.source === "string" ? raw.source : "",
    necessity:    typeof raw.necessity === "string" ? raw.necessity : "",
    remark:       typeof raw.remark === "string" ? raw.remark : "",
    documentId:   typeof raw.documentId === "string" ? raw.documentId : undefined,
  };
}

const RAW_DATA_KEY = "rawData";
const THEME_KEY = "theme";
const DOCS_KEY = "documents";
const BACKUPS_KEY = "backups";
const MAX_BACKUPS = 1;

export interface BackupRecord {
  id: string;
  timestamp: number;
  rawData: BillRecord[];
  documents: DocumentMeta[];
}

export async function saveRawData(data: BillRecord[]) {
  await store.setItem(RAW_DATA_KEY, data);
}

export async function loadRawData(): Promise<BillRecord[]> {
  const data = await store.getItem<unknown[]>(RAW_DATA_KEY);
  if (!data || !Array.isArray(data)) return [];
  return data.map((r) => migrateRecord(r as Record<string, unknown>));
}

export async function saveDocuments(docs: DocumentMeta[]) {
  await store.setItem(DOCS_KEY, docs);
}

export async function loadDocuments() {
  const docs = await store.getItem<DocumentMeta[]>(DOCS_KEY);
  return docs ?? [];
}

export async function saveTheme(theme: ThemeMode) {
  await store.setItem(THEME_KEY, theme);
}

export async function loadTheme() {
  const theme = await store.getItem<ThemeMode>(THEME_KEY);
  return theme ?? "dark";
}

export async function createBackup(rawData: BillRecord[], documents: DocumentMeta[]): Promise<BackupRecord> {
  const backup: BackupRecord = {
    id: `backup_${Date.now()}`,
    timestamp: Date.now(),
    rawData: JSON.parse(JSON.stringify(rawData)),
    documents: JSON.parse(JSON.stringify(documents)),
  };
  const existing = await store.getItem<BackupRecord[]>(BACKUPS_KEY);
  const list = existing ?? [];
  const next = [backup, ...list].slice(0, MAX_BACKUPS);
  await store.setItem(BACKUPS_KEY, next);
  return backup;
}

export async function listBackups(): Promise<BackupRecord[]> {
  const list = await store.getItem<BackupRecord[]>(BACKUPS_KEY);
  return list ?? [];
}

export async function restoreBackup(backupId: string): Promise<{ rawData: BillRecord[]; documents: DocumentMeta[] } | null> {
  const list = await store.getItem<BackupRecord[]>(BACKUPS_KEY);
  const backup = list?.find((b) => b.id === backupId);
  if (!backup) return null;
  return {
    rawData: (backup.rawData ?? []).map((r) => migrateRecord(r as unknown as Record<string, unknown>)),
    documents: backup.documents ?? [],
  };
}

export async function deleteBackup(backupId: string): Promise<void> {
  const list = await store.getItem<BackupRecord[]>(BACKUPS_KEY);
  if (!list) return;
  const next = list.filter((b) => b.id !== backupId);
  await store.setItem(BACKUPS_KEY, next);
}
