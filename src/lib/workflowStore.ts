export type WorkflowStatus = "pending" | "approved" | "rejected";

export interface SoftwareRequest {
  id: string;
  softwareName: string;
  category: string;
  platform: string;
  description: string;
  downloadUrl: string;
  email: string;
  isRepack: boolean;
  status: WorkflowStatus;
  createdAt: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "unread" | "read" | "resolved";
  createdAt: string;
}

export interface SoftwareReview {
  id: string;
  softwareId: string;
  softwareTitle: string;
  user: string;
  email: string;
  comment: string;
  status: WorkflowStatus;
  createdAt: string;
}

export interface DeadLinkReport {
  id: string;
  softwareId: string;
  softwareTitle: string;
  url: string;
  reportedBy: string;
  message: string;
  status: "pending" | "resolved";
  createdAt: string;
}

export type WorkflowKey = "softwareRequests" | "contactMessages" | "softwareReviews" | "deadLinkReports";

const WORKFLOW_EVENT = "workflow-store-changed";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readRecords<T>(key: WorkflowKey): T[] {
  if (!isBrowser()) return [];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

function writeRecords<T>(key: WorkflowKey, records: T[]): boolean {
  if (!isBrowser()) return false;
  try {
    localStorage.setItem(key, JSON.stringify(records));
    window.dispatchEvent(new CustomEvent(WORKFLOW_EVENT, { detail: key }));
    return true;
  } catch {
    return false;
  }
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getWorkflowRecords<T>(key: WorkflowKey): T[] {
  return readRecords<T>(key);
}

export function addWorkflowRecord<T extends { id: string }>(key: WorkflowKey, record: Omit<T, "id">): T | null {
  const created = { ...record, id: createId(key.slice(0, 4)) } as T;
  return writeRecords(key, [...readRecords<T>(key), created]) ? created : null;
}

export function updateWorkflowRecord<T extends { id: string }>(key: WorkflowKey, id: string, changes: Partial<T>): boolean {
  const records = readRecords<T>(key);
  return writeRecords(key, records.map((record) => record.id === id ? { ...record, ...changes } : record));
}

export function deleteWorkflowRecord<T extends { id: string }>(key: WorkflowKey, id: string): boolean {
  const records = readRecords<T>(key);
  return writeRecords(key, records.filter((record) => record.id !== id));
}

export function subscribeToWorkflowChanges(listener: () => void): () => void {
  if (!isBrowser()) return () => {};
  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key === "softwareRequests" || event.key === "contactMessages" || event.key === "softwareReviews" || event.key === "deadLinkReports") listener();
  };
  const handleCustom = () => listener();
  window.addEventListener("storage", handleStorage);
  window.addEventListener(WORKFLOW_EVENT, handleCustom);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(WORKFLOW_EVENT, handleCustom);
  };
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidHttpUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function getDeadLinkReports(): DeadLinkReport[] {
  return readRecords<DeadLinkReport>("deadLinkReports");
}

export function addDeadLinkReport(report: Omit<DeadLinkReport, "id" | "status" | "createdAt">): DeadLinkReport | null {
  const existing = readRecords<DeadLinkReport>("deadLinkReports");
  const countForUrl = existing.filter((r) => r.url === report.url).length;
  if (countForUrl >= 5) return null;
  const created: DeadLinkReport = {
    ...report,
    id: createId("dlr"),
    status: "pending",
    createdAt: new Date().toISOString().split("T")[0],
  };
  return writeRecords("deadLinkReports", [...existing, created]) ? created : null;
}

export function resolveDeadLinkReport(id: string): boolean {
  const records = readRecords<DeadLinkReport>("deadLinkReports");
  return writeRecords("deadLinkReports", records.map((r) => r.id === id ? { ...r, status: "resolved" as const } : r));
}
