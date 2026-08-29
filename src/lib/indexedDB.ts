"use client";

import { type Software } from "@/lib/data";

const DB_NAME = "PixelVault";
const DB_VERSION = 1;
const STORE_NAME = "software";

interface IndexedDBResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(new Error(request.error?.message || "Failed to open IndexedDB"));
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("category", "category", { unique: false });
        store.createIndex("title", "title", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
  });
}

export async function idbGetAll(): Promise<Software[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(new Error(request.error?.message || "Failed to get all items"));
  });
}

export async function idbGetByCategory(category: string): Promise<Software[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("category");
    const request = index.getAll(category);
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(new Error(request.error?.message || "Failed to get by category"));
  });
}

export async function idbGetById(id: string): Promise<Software | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(request.error?.message || "Failed to get by id"));
  });
}

export async function idbSearch(query: string): Promise<Software[]> {
  const db = await openDB();
  const all = await idbGetAll();
  const lower = query.toLowerCase();
  return all.filter(
    (s) =>
      s.title.toLowerCase().includes(lower) ||
      s.description?.toLowerCase().includes(lower) ||
      s.category?.toLowerCase().includes(lower)
  );
}

export async function idbSaveAll(data: Software[]): Promise<{ success: boolean; error?: string }> {
  const db = await openDB();
  
  return new Promise((resolve) => {
    let hasError = false;
    let lastError: string | undefined;

    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    
    // Clear existing data first
    const clearRequest = store.clear();
    clearRequest.onsuccess = () => {
      let completed = 0;
      
      for (const item of data) {
        const request = store.add(item);
        request.onsuccess = () => {
          completed++;
          if (completed === data.length && !hasError) {
            resolve({ success: true });
          }
        };
        request.onerror = () => {
          if (!hasError) {
            hasError = true;
            lastError = request.error?.message || "Unknown error";
          }
        };
      }
    };
    
    clearRequest.onerror = () => {
      resolve({ success: false, error: clearRequest.error?.message || "Failed to clear" });
    };
    
    transaction.oncomplete = () => {
      if (!hasError) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: lastError });
      }
    };
    
    transaction.onerror = () => {
      resolve({ success: false, error: transaction.error?.message || "Transaction failed" });
    };
  });
}

export async function idbUpdate(item: Software): Promise<{ success: boolean; error?: string }> {
  const db = await openDB();
  
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(item);
    
    request.onsuccess = () => resolve({ success: true });
    request.onerror = () => resolve({ success: false, error: request.error?.message || "Failed to update" });
  });
}

export async function idbDelete(id: string): Promise<{ success: boolean; error?: string }> {
  const db = await openDB();
  
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve({ success: true });
    request.onerror = () => resolve({ success: false, error: request.error?.message || "Failed to delete" });
  });
}

export async function idbGetCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(request.error?.message || "Failed to count"));
  });
}

export async function idbClearAll(): Promise<{ success: boolean; error?: string }> {
  const db = await openDB();
  
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    
    request.onsuccess = () => resolve({ success: true });
    request.onerror = () => resolve({ success: false, error: request.error?.message || "Failed to clear" });
  });
}

export async function idbGetStorageInfo(): Promise<{ count: number; estimatedSizeKB: number }> {
  const data = await idbGetAll();
  const jsonSize = new Blob([JSON.stringify(data)]).size;
  return {
    count: data.length,
    estimatedSizeKB: Math.round(jsonSize / 1024),
  };
}