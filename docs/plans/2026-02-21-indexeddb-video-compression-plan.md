# IndexedDB Migration + Video Compression Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace localStorage with IndexedDB for offline specimen storage and add MediaRecorder bitrate capping to reduce video file sizes by ~85%.

**Architecture:** Lazy-init IDB singleton via `idb` library. All `storage.*` methods become async. One-time migration copies existing localStorage data into IDB on first open. Videos compressed at 500kbps via MediaRecorder option — no post-processing needed.

**Tech Stack:** `idb` v8 (IndexedDB wrapper), existing React/TypeScript/Vite stack

**Design doc:** `docs/plans/2026-02-21-indexeddb-video-compression-design.md`

**Working directory:** `D:/Documents/Gregor/Projects/smart-microscopy-system/.worktrees/feature/mvp-implementation`

---

## Task 1: Install `idb` dependency

**Files:**
- Modify: `package.json`

**Step 1: Install the package**

Run in the worktree root:
```bash
cd D:/Documents/Gregor/Projects/smart-microscopy-system/.worktrees/feature/mvp-implementation
npm install idb
```

Expected output: `added 1 package` (idb is zero-dependency)

**Step 2: Verify it installed**

Run:
```bash
ls node_modules/idb/build/
```
Expected: see `index.js`, `index.d.ts` and similar files

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add idb for IndexedDB wrapper"
```

---

## Task 2: Remove `StorageData` from types and rewrite `storage.ts`

**Files:**
- Modify: `src/types/specimen.ts` — remove `StorageData` interface
- Modify: `src/lib/storage.ts` — full rewrite with IDB

### Step 1: Remove `StorageData` from `src/types/specimen.ts`

Open `src/types/specimen.ts`. Delete the `StorageData` interface at the bottom (lines ~34-39):

```typescript
// DELETE THIS:
export interface StorageData {
  specimens: Specimen[];
  syncStatus: SyncStatus;
  settings: UserSettings;
}
```

The file should now end after the `UserSettings` interface. Verify the file looks like:

```typescript
export interface Specimen {
  id: string;
  name: string;
  description?: string;
  capturedAt: Date;
  imageUrl: string;
  videoUrl?: string;
  annotations: Annotation[];
  tags?: string[];
  syncedToCloud: boolean;
  userId?: string;
}

export interface Annotation {
  id: string;
  type: 'freehand' | 'text' | 'shape';
  data: any;
  color: string;
  createdAt: Date;
}

export interface SyncStatus {
  lastSyncedAt?: Date;
  pendingUploads: string[];
  isOnline: boolean;
}

export interface UserSettings {
  cameraDeviceId?: string;
  enableCloudSync: boolean;
  enableNotifications: boolean;
}
```

### Step 2: Rewrite `src/lib/storage.ts`

Replace the entire file with:

```typescript
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

const DEFAULT_SYNC_STATUS: SyncStatus = {
  pendingUploads: [],
  isOnline: navigator.onLine,
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

  async updateSettings(updates: Partial<UserSettings>): Promise<void> {
    const db = await getDB();
    const current = await this.getSettings();
    await db.put('settings', { ...current, ...updates }, 'userSettings');
  },

  async getSyncStatus(): Promise<SyncStatus> {
    const db = await getDB();
    const status = await db.get('settings', 'syncStatus');
    return (status as SyncStatus) ?? DEFAULT_SYNC_STATUS;
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
```

### Step 3: Build check

Run:
```bash
npx tsc --noEmit
```

Expected: No errors referencing `StorageData`, `getData`, or `saveData`. If TypeScript complains about callers still using those, that's expected — they're fixed in Tasks 3–5. Fix any other unexpected type errors before continuing.

### Step 4: Commit

```bash
git add src/types/specimen.ts src/lib/storage.ts
git commit -m "feat: replace localStorage with IndexedDB via idb library"
```

---

## Task 3: Update `useSpecimens.ts`

**Files:**
- Modify: `src/hooks/useSpecimens.ts`

The hook calls `storage.getData()` synchronously. Replace with async `getSpecimens()`.

### Step 1: Replace `useSpecimens.ts` contents

```typescript
import { useState, useEffect, useCallback } from 'react';
import { Specimen } from '@/types/specimen';
import { storage } from '@/lib/storage';

export function useSpecimens() {
  const [specimens, setSpecimens] = useState<Specimen[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadSpecimens = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await storage.getSpecimens();
      setSpecimens(data);
    } catch (error) {
      console.error('Error loading specimens:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSpecimens();
  }, [loadSpecimens]);

  const filteredSpecimens = specimens.filter(specimen =>
    specimen.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    specimen.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    specimen.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const deleteSpecimen = useCallback(async (id: string) => {
    await storage.deleteSpecimen(id);
    await loadSpecimens();
  }, [loadSpecimens]);

  const updateSpecimen = useCallback(async (id: string, updates: Partial<Specimen>) => {
    await storage.updateSpecimen(id, updates);
    await loadSpecimens();
  }, [loadSpecimens]);

  return {
    specimens: filteredSpecimens,
    allSpecimens: specimens,
    isLoading,
    searchQuery,
    setSearchQuery,
    deleteSpecimen,
    updateSpecimen,
    reload: loadSpecimens,
  };
}
```

### Step 2: Check callers of `deleteSpecimen` and `updateSpecimen`

These were previously synchronous. They are called from:
- `src/components/library/SpecimenGrid.tsx` → passes to `SpecimenCard`
- `src/pages/LibraryView.tsx` → passes to `SpecimenDetailDialog`

The signatures don't change (still `(id: string) => void` from the caller's perspective), so no updates needed in those files. React doesn't care if a callback returns a Promise.

### Step 3: Build check

```bash
npx tsc --noEmit
```

Expected: Errors only from `sync.ts` (still uses old API) — those are fixed in Task 4.

### Step 4: Commit

```bash
git add src/hooks/useSpecimens.ts
git commit -m "feat: update useSpecimens to use async IndexedDB storage"
```

---

## Task 4: Update `sync.ts`

**Files:**
- Modify: `src/lib/sync.ts`

Four `storage.*` calls need updating. All are already inside `async` functions, so this is purely mechanical.

### Step 1: Update `syncSpecimen` (line ~104)

Find this line in `syncSpecimen`:
```typescript
// Mark as synced in localStorage
storage.updateSpecimen(specimen.id, { syncedToCloud: true });
```

Change to:
```typescript
// Mark as synced in IndexedDB
await storage.updateSpecimen(specimen.id, { syncedToCloud: true });
```

### Step 2: Update `syncAllPending` (~line 117)

Find:
```typescript
const data = storage.getData();
const pending = data.specimens.filter(s => !s.syncedToCloud);
```

Change to:
```typescript
const specimens = await storage.getSpecimens();
const pending = specimens.filter(s => !s.syncedToCloud);
```

### Step 3: Update `pullFromCloud` (~line 176)

Find:
```typescript
const localData = storage.getData();
let imported = 0;
let updated = 0;

for (const cloudSpec of cloudSpecimens) {
  const existingIndex = localData.specimens.findIndex(s => s.id === cloudSpec.id);

  if (existingIndex === -1) {
    // ...
    storage.addSpecimen(specimen);
    imported++;
  } else {
    const localSpecimen = localData.specimens[existingIndex];
    const resolved = resolveConflict(localSpecimen, cloudSpec);

    if (resolved !== localSpecimen) {
      storage.updateSpecimen(cloudSpec.id, resolved);
      updated++;
    }
  }
}
```

Change to:
```typescript
const localSpecimens = await storage.getSpecimens();
let imported = 0;
let updated = 0;

for (const cloudSpec of cloudSpecimens) {
  const existing = localSpecimens.find(s => s.id === cloudSpec.id);

  if (!existing) {
    // New specimen - import it
    const specimen: Specimen = {
      id: cloudSpec.id,
      name: cloudSpec.name,
      description: cloudSpec.description,
      capturedAt: new Date(cloudSpec.captured_at),
      imageUrl: cloudSpec.image_url,
      videoUrl: cloudSpec.video_url,
      annotations: cloudSpec.annotations || [],
      tags: cloudSpec.tags || [],
      syncedToCloud: true,
    };

    await storage.addSpecimen(specimen);
    imported++;
  } else {
    // Conflict - resolve using "last write wins"
    const resolved = resolveConflict(existing, cloudSpec);

    if (resolved !== existing) {
      await storage.updateSpecimen(cloudSpec.id, resolved);
      updated++;
    }
  }
}
```

### Step 4: Build check

```bash
npx tsc --noEmit
```

Expected: Errors only from `MicroscopeView.tsx` (still uses old `addSpecimen` without await).

### Step 5: Commit

```bash
git add src/lib/sync.ts
git commit -m "feat: update sync.ts to use async IndexedDB storage"
```

---

## Task 5: Update `MicroscopeView.tsx`

**Files:**
- Modify: `src/pages/MicroscopeView.tsx`

### Step 1: Find the `addSpecimen` call

Search for `storage.addSpecimen` in `MicroscopeView.tsx`. It will look like:

```typescript
storage.addSpecimen(specimen);
```

Change to:
```typescript
await storage.addSpecimen(specimen);
```

The surrounding function is already `async`, so this is safe.

### Step 2: Clean up the import if needed

Check the import at the top of the file. If it still imports `StorageData`:
```typescript
import { Specimen, StorageData } from '@/types/specimen'; // ❌ StorageData removed
```
Change to:
```typescript
import { Specimen } from '@/types/specimen';
```

### Step 3: Full build check

```bash
npx tsc --noEmit
```

Expected: **Zero errors.** If any errors remain, fix before continuing.

### Step 4: Commit

```bash
git add src/pages/MicroscopeView.tsx
git commit -m "feat: await addSpecimen in MicroscopeView for IndexedDB"
```

---

## Task 6: Add video bitrate cap in `useVideoRecorder.ts`

**Files:**
- Modify: `src/hooks/useVideoRecorder.ts`

### Step 1: Find the `MediaRecorder` constructor call

In `useVideoRecorder.ts`, find:
```typescript
const mediaRecorder = new MediaRecorder(stream, {
  mimeType: 'video/webm',
});
```

### Step 2: Replace with bitrate-capped version

```typescript
// Prefer vp9 for better compression; fall back to browser default codec
const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
  ? 'video/webm;codecs=vp9'
  : MediaRecorder.isTypeSupported('video/webm')
  ? 'video/webm'
  : '';

const recorderOptions: MediaRecorderOptions = {
  videoBitsPerSecond: 500_000, // 500kbps — reduces 15s video from ~7MB to ~1MB
};
if (mimeType) {
  recorderOptions.mimeType = mimeType;
}

const mediaRecorder = new MediaRecorder(stream, recorderOptions);
```

### Step 3: Build check

```bash
npx tsc --noEmit
```

Expected: Zero errors.

### Step 4: Commit

```bash
git add src/hooks/useVideoRecorder.ts
git commit -m "feat: cap video recording bitrate at 500kbps for ~85% size reduction"
```

---

## Task 7: Manual verification

**Step 1: Start the dev server**

```bash
npm run dev
```

Open: `http://localhost:5173`

**Step 2: Verify storage migration**

If you have existing specimens in localStorage:
1. Open DevTools → Application → Local Storage → check `sms_specimens` exists with data
2. Reload the page
3. Open DevTools → Application → IndexedDB → `sms-db` → `specimens`
4. Verify your old specimens appear there
5. Verify `sms_specimens` key is **gone** from Local Storage

If no existing specimens, skip to Step 3.

**Step 3: Verify IDB write (new specimen)**

1. Start camera
2. Capture a screenshot
3. Add annotations
4. Save to library
5. Open DevTools → IndexedDB → `sms-db` → `specimens` → verify the new record exists
6. Navigate to Library view → specimen should appear

**Step 4: Verify persistence**

1. Hard-refresh the page (Ctrl+Shift+R)
2. Navigate to Library
3. Specimen from Step 3 should still be there (loaded from IDB, not localStorage)

**Step 5: Verify video compression**

1. Record a ~15 second video
2. Stop recording
3. Save specimen with video
4. Open DevTools → IndexedDB → `sms-db` → specimens → find the record
5. Check `videoUrl` field length — base64 of a 500kbps 15s video should be roughly 1-1.5MB (compare to old ~7MB)
6. Play the video back in the specimen detail dialog — quality should be acceptable for lab use

**Step 6: Verify sync.ts still works (if Supabase configured)**

1. If `VITE_SUPABASE_URL` is set in `.env.local`, click the Sync button
2. Verify no console errors from `sync.ts`
3. Verify specimens appear in Supabase dashboard (or console logs show sync attempt)

**Step 7: Final build check**

```bash
npm run build
```

Expected: Build completes with no TypeScript errors. Bundle size should be similar — `idb` is ~7KB.

**Step 8: Commit**

```bash
git add .
git commit -m "docs: verify IndexedDB migration and video compression working"
```

---

## Task 8: Final cleanup

### Step 1: Remove dead code from `capture.ts` (optional)

Open `src/lib/capture.ts`. The `blobToDataURL` function is still valid (used when saving videos as data URLs) — **leave it**. No cleanup needed there.

### Step 2: Check for any remaining `localStorage` references in TypeScript files

```bash
grep -r "localStorage" src/ --include="*.ts" --include="*.tsx"
```

Expected: No results in `.ts`/`.tsx` files. (The migration code in `storage.ts` is the only intentional reference — but it references the legacy key to migrate away from it, which is correct.)

### Step 3: Final commit

```bash
git add .
git commit -m "chore: final cleanup after IndexedDB migration"
```

---

## Summary

**Total tasks:** 8
**Files changed:** 7
**New dependencies:** 1 (`idb`)

### What changed

| What | Before | After |
|------|--------|-------|
| Local storage | localStorage (~5-10MB) | IndexedDB (~50-100MB) |
| 15s video size | ~7MB | ~1MB |
| Storage API | Synchronous | Async (all Promise-based) |
| Migration | N/A | Auto-runs once on first load |
| `StorageData` type | Existed | Removed |
| `getData()` method | Existed | Removed — use `getSpecimens()` |

### Quick storage math (post-migration)

With 500kbps cap and 50MB IDB quota:
- Images only: ~300KB each → **160+ specimens**
- With 15s videos: ~1.3MB each → **38+ specimens with video**
- With 60s videos: ~4.5MB each → **11+ specimens with full-length video**
