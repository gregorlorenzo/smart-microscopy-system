# IndexedDB Migration + Video Compression Design

**Date:** February 21, 2026
**Context:** Post-MVP improvement — resolves localStorage quota limitations documented in VIDEO_STORAGE_FIX.md

---

## Problem

- `localStorage` has a ~5-10MB quota per domain
- A single 15-second video recording exhausts the entire quota
- The current workaround (warning dialog + image-only save) is functional but limits the app's value
- `VIDEO_STORAGE_FIX.md` identified IndexedDB as the correct long-term solution

---

## Goals

1. **Increase local storage capacity** from ~5-10MB to ~50-100MB using IndexedDB
2. **Reduce video file sizes** by ~85% using MediaRecorder bitrate capping (500kbps)
3. **Preserve existing specimens** via automatic one-time migration from localStorage
4. **Keep code changes minimal** — no type changes to `Specimen`, no new UI, no new dependencies beyond `idb`

---

## Approach

**Option chosen:** `idb` library wrapper (Option A)

- `idb` is a 7KB Promise-based wrapper around IndexedDB
- Videos continue to be stored as base64 data URLs — `Specimen.videoUrl: string` unchanged
- With 500kbps bitrate cap: 15s video ~1MB → 40+ videos in 50MB IDB quota
- No new object stores for videos needed; no `Blob` URL lifecycle management

**Rejected alternatives:**
- Raw IndexedDB API: too verbose, no benefit over `idb`
- Native Blob storage in separate IDB store: complexity not justified given bitrate cap already solves the size problem

---

## Section 1: Data Layer

### IDB Schema — `sms-db` version 1

```typescript
interface SMSDBSchema extends DBSchema {
  specimens: {
    key: string;         // UUID
    value: Specimen;     // Same type as before, no changes
  };
  settings: {
    key: string;         // 'userSettings' | 'syncStatus'
    value: UserSettings | SyncStatus;
  };
}
```

### Database Initialization

Lazy singleton pattern — `getDB()` opens the database once per session. Migration runs inside the init promise, before the db is returned to any caller.

### Type Changes

- `StorageData` interface in `types/specimen.ts` — **removed** (was only used as `getData()` return type)
- All other types (`Specimen`, `Annotation`, `UserSettings`, `SyncStatus`) — **unchanged**

---

## Section 2: New `storage.ts` API

All methods are now `async` and return `Promise`.

```typescript
export const storage = {
  // Specimens
  async getSpecimens(): Promise<Specimen[]>
  async addSpecimen(specimen: Specimen): Promise<void>
  async updateSpecimen(id: string, updates: Partial<Specimen>): Promise<void>
  async deleteSpecimen(id: string): Promise<void>
  async getSpecimen(id: string): Promise<Specimen | undefined>

  // Settings
  async getSettings(): Promise<UserSettings>
  async updateSettings(settings: Partial<UserSettings>): Promise<void>

  // Sync status
  async getSyncStatus(): Promise<SyncStatus>
  async updateSyncStatus(status: Partial<SyncStatus>): Promise<void>

  // Migration (called once on init)
  async migrateFromLocalStorage(): Promise<void>

  // Quota check (unchanged)
  async checkStorageQuota(): Promise<{ usage: number; quota: number; percentUsed: number }>
};
```

**Removed:** `getData()`, `saveData()`

### Caller Changes

| File | Was | Now |
|------|-----|-----|
| `useSpecimens.ts` | `storage.getData().specimens` | `await storage.getSpecimens()` |
| `sync.ts` line 117 | `storage.getData()` | `await storage.getSpecimens()` |
| `sync.ts` line 176 | `storage.getData()` | `await storage.getSpecimens()` |
| `sync.ts` line 104 | `storage.updateSpecimen(...)` | `await storage.updateSpecimen(...)` |
| `sync.ts` line 198 | `storage.addSpecimen(...)` | `await storage.addSpecimen(...)` |
| `sync.ts` line 207 | `storage.updateSpecimen(...)` | `await storage.updateSpecimen(...)` |
| `MicroscopeView.tsx` | `storage.addSpecimen(specimen)` | `await storage.addSpecimen(specimen)` |

---

## Section 3: Video Compression

Single change in `useVideoRecorder.ts`:

```typescript
// Before:
const mediaRecorder = new MediaRecorder(stream, {
  mimeType: 'video/webm',
});

// After:
const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
  ? 'video/webm;codecs=vp9'
  : 'video/webm';

const mediaRecorder = new MediaRecorder(stream, {
  mimeType,
  videoBitsPerSecond: 500_000,  // 500kbps cap
});
```

**Result:**
- 15s video: ~7MB → ~1MB (85% reduction)
- 30s video: ~14MB → ~2MB
- 60s video: ~28MB → ~4MB
- IDB quota (50MB): supports ~12 full 60s videos, or 50+ 15s clips

---

## Section 4: Migration

Runs automatically once when the database is first opened. Idempotent — skips if IDB already has specimens.

```typescript
async function migrateFromLocalStorage(db: IDBPDatabase<SMSDBSchema>) {
  const LEGACY_KEY = 'sms_specimens';
  const existing = localStorage.getItem(LEGACY_KEY);
  if (!existing) return;

  const idbEmpty = (await db.count('specimens')) === 0;
  if (!idbEmpty) return;

  try {
    const data = JSON.parse(existing);
    if (data.specimens?.length) {
      const tx = db.transaction('specimens', 'readwrite');
      for (const s of data.specimens) {
        await tx.store.put({
          ...s,
          capturedAt: new Date(s.capturedAt),
          annotations: s.annotations.map((a: any) => ({
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
  } catch (e) {
    console.error('Migration from localStorage failed:', e);
    // Don't throw — app continues with empty IDB
  }
}
```

---

## Files Changed

| File | Change type |
|------|-------------|
| `package.json` | Add `idb` dependency |
| `src/lib/storage.ts` | Full rewrite (~120 lines) |
| `src/types/specimen.ts` | Remove `StorageData` interface |
| `src/hooks/useSpecimens.ts` | Minor: async load, call migration once |
| `src/lib/sync.ts` | Minor: replace `getData()` calls, add `await` |
| `src/pages/MicroscopeView.tsx` | 1 line: add `await` to `addSpecimen()` |
| `src/hooks/useVideoRecorder.ts` | ~5 lines: add codec + bitrate cap |

---

## Alignment with Original Design

The original system design (`2026-02-14-smart-microscopy-system-design.md`) specified:
> "localStorage (Offline-first cache)"

This design replaces localStorage with IndexedDB while preserving the offline-first architecture. The Supabase sync layer is unaffected. All other architectural decisions remain unchanged.

---

**Design Approved:** February 21, 2026
**Next step:** Create implementation plan using writing-plans skill
