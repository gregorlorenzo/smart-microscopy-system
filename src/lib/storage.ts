import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Specimen, UserSettings, SyncStatus } from '@/types/specimen';

interface SMSDBSchema extends DBSchema {
  specimens: {
    key: string;
    value: Specimen;
  };
  settings: {
    key: string;
    value: UserSettings | SyncStatus;
  };
}

const DB_NAME = 'sms-db';
const DB_VERSION = 1;
const LEGACY_KEY = 'sms_specimens';

const DEFAULT_SETTINGS: UserSettings = {
  enableCloudSync: false,
  enableNotifications: true,
};

let dbPromise: Promise<IDBPDatabase<SMSDBSchema>> | null = null;

function getDB(): Promise<IDBPDatabase<SMSDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<SMSDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('specimens')) {
          db.createObjectStore('specimens', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    }).then(async (db) => {
      await migrateFromLocalStorage(db);
      return db;
    });
  }
  return dbPromise;
}

async function migrateFromLocalStorage(db: IDBPDatabase<SMSDBSchema>): Promise<void> {
  const existing = localStorage.getItem(LEGACY_KEY);
  if (!existing) return;

  const idbCount = await db.count('specimens');
  if (idbCount > 0) return; // IDB already has data, skip migration

  try {
    const data = JSON.parse(existing);

    if (data.specimens && Array.isArray(data.specimens) && data.specimens.length > 0) {
      const tx = db.transaction('specimens', 'readwrite');
      for (const s of data.specimens) {
        await tx.store.put({
          ...s,
          capturedAt: new Date(s.capturedAt),
          annotations: (s.annotations || []).map((a: any) => ({
            ...a,
            createdAt: new Date(a.createdAt),
          })),
        });
      }
      await tx.done;
    }

    if (data.settings) {
      await db.put('settings', data.settings, 'userSettings');
    }

    localStorage.removeItem(LEGACY_KEY);
    console.log('[storage] Migrated from localStorage to IndexedDB');
  } catch (error) {
    console.error('[storage] Migration failed, continuing with empty IDB:', error);
    // Don't rethrow — app works fine starting fresh
  }
}

export const storage = {
  async getSpecimens(): Promise<Specimen[]> {
    const db = await getDB();
    const specimens = await db.getAll('specimens');
    // Sort newest first (IDB doesn't guarantee order)
    return specimens.sort(
      (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
    );
  },

  async addSpecimen(specimen: Specimen): Promise<void> {
    const db = await getDB();
    await db.put('specimens', specimen);
  },

  async updateSpecimen(id: string, updates: Partial<Specimen>): Promise<void> {
    const db = await getDB();
    const existing = await db.get('specimens', id);
    if (existing) {
      await db.put('specimens', { ...existing, ...updates });
    }
  },

  async deleteSpecimen(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('specimens', id);
  },

  async getSpecimen(id: string): Promise<Specimen | undefined> {
    const db = await getDB();
    return db.get('specimens', id);
  },

  async getSettings(): Promise<UserSettings> {
    const db = await getDB();
    const settings = await db.get('settings', 'userSettings');
    return (settings as UserSettings) ?? DEFAULT_SETTINGS;
  },

  async getDeviceId(): Promise<string> {
    const settings = await this.getSettings();
    if (settings.deviceId) return settings.deviceId;
    const deviceId = crypto.randomUUID();
    await this.updateSettings({ deviceId });
    return deviceId;
  },

  async updateSettings(updates: Partial<UserSettings>): Promise<void> {
    const db = await getDB();
    const current = await this.getSettings();
    await db.put('settings', { ...current, ...updates }, 'userSettings');
  },

  async getSyncStatus(): Promise<SyncStatus> {
    const db = await getDB();
    const status = await db.get('settings', 'syncStatus');
    return (status as SyncStatus) ?? { pendingUploads: [], isOnline: navigator.onLine };
  },

  async updateSyncStatus(updates: Partial<SyncStatus>): Promise<void> {
    const db = await getDB();
    const current = await this.getSyncStatus();
    await db.put('settings', { ...current, ...updates }, 'syncStatus');
  },

  async checkStorageQuota(): Promise<{ usage: number; quota: number; percentUsed: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      return {
        usage,
        quota,
        percentUsed: quota > 0 ? (usage / quota) * 100 : 0,
      };
    }
    return { usage: 0, quota: 0, percentUsed: 0 };
  },
};
