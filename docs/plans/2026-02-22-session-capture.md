# Session Capture & Save to Library — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add screenshot capture, save-to-library, and video recording to the session stream page for both presenter and viewer roles.

**Architecture:** Extend `SessionAnnotationToolbar` with capture/record controls (presenter), add a minimal viewer capture bar, and wire capture state + handlers in `SessionStreamPage`. All existing infrastructure (`SaveSpecimenDialog`, `useVideoRecorder`, `mergeImages`, `storage`) is reused unchanged.

**Tech Stack:** React, TypeScript, Fabric.js v7, Supabase, IndexedDB (via `storage`), `uuid`

---

## Task 1: Extend SessionAnnotationToolbar with capture + record controls

**Files:**
- Modify: `src/components/session/SessionAnnotationToolbar.tsx`

The toolbar currently has annotation tools only. We add a right-hand group: Record button (video, presenter only), Capture button (with green dot badge when a frame is ready), and Save button.

**Step 1: Replace the entire file with the extended version**

```typescript
import { MousePointer, Pen, Type, Undo2, Trash2, Camera, Save, Video, Square } from 'lucide-react';
import { DrawMode } from '@/hooks/useAnnotations';

interface SessionAnnotationToolbarProps {
  // Existing annotation props
  drawMode: DrawMode;
  brushColor: string;
  brushSize: number;
  canUndo: boolean;
  onModeChange: (mode: DrawMode) => void;
  onColorChange: (color: string) => void;
  onSizeChange: (size: number) => void;
  onUndo: () => void;
  onClear: () => void;
  // New capture props
  captureReady: boolean;        // true after a frame has been captured
  canSave: boolean;             // same as captureReady, drives Save button enabled state
  onCapture: () => void;
  onSave: () => void;
  // New recording props
  isRecording: boolean;
  recordingTime: number;        // seconds elapsed
  onStartRecording: () => void;
  onStopRecording: () => void;
}

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#a855f7', '#ffffff', '#000000',
];

const SIZES = [3, 6, 12];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function SessionAnnotationToolbar({
  drawMode, brushColor, brushSize, canUndo,
  onModeChange, onColorChange, onSizeChange, onUndo, onClear,
  captureReady, canSave, onCapture, onSave,
  isRecording, recordingTime, onStartRecording, onStopRecording,
}: SessionAnnotationToolbarProps) {
  const btn = (active: boolean, disabled = false) =>
    `w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
      disabled
        ? 'text-gray-600 cursor-not-allowed'
        : active
        ? 'bg-white text-gray-900'
        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
    }`;

  return (
    <div className="flex items-center justify-center gap-1 px-4 py-3 bg-gray-900/95 backdrop-blur border-t border-gray-800 flex-wrap">
      {/* Mode buttons */}
      <button className={btn(drawMode === 'select')} onClick={() => onModeChange('select')} title="Select / Move">
        <MousePointer className="w-4 h-4" />
      </button>
      <button className={btn(drawMode === 'pen')} onClick={() => onModeChange('pen')} title="Draw">
        <Pen className="w-4 h-4" />
      </button>
      <button className={btn(drawMode === 'text')} onClick={() => onModeChange('text')} title="Add Text">
        <Type className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Brush sizes */}
      {SIZES.map((s) => (
        <button key={s} className={btn(brushSize === s)} onClick={() => onSizeChange(s)} title={`${s}px brush`}>
          <div className={`rounded-full ${brushSize === s ? 'bg-gray-900' : 'bg-current'}`} style={{ width: s + 4, height: s + 4 }} />
        </button>
      ))}

      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Color swatches */}
      {COLORS.map((color) => (
        <button
          key={color}
          onClick={() => onColorChange(color)}
          className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
            brushColor === color ? 'border-white scale-110' : 'border-gray-600'
          }`}
          style={{ backgroundColor: color }}
          title={color}
        />
      ))}

      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Undo / Clear */}
      <button className={btn(false, !canUndo)} onClick={onUndo} disabled={!canUndo} title="Undo last annotation">
        <Undo2 className="w-4 h-4" />
      </button>
      <button className={btn(false)} onClick={onClear} title="Clear all annotations">
        <Trash2 className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Video recording */}
      {isRecording ? (
        <button
          className="h-9 px-3 rounded-lg flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors"
          onClick={onStopRecording}
          title="Stop recording"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          {formatTime(recordingTime)}
        </button>
      ) : (
        <button className={btn(false)} onClick={onStartRecording} title="Record video">
          <Video className="w-4 h-4" />
        </button>
      )}

      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Capture + Save */}
      <button
        className={`${btn(false)} relative`}
        onClick={onCapture}
        title="Capture screenshot"
      >
        <Camera className="w-4 h-4" />
        {captureReady && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-gray-900" />
        )}
      </button>
      <button
        className={`h-9 px-3 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors ${
          canSave
            ? 'bg-blue-600 text-white hover:bg-blue-500'
            : 'text-gray-600 cursor-not-allowed'
        }`}
        onClick={onSave}
        disabled={!canSave}
        title="Save to Library"
      >
        <Save className="w-3.5 h-3.5" />
        Save
      </button>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors (the new props are not yet wired — SessionStreamPage will show errors, fix in Task 2).

**Step 3: Commit**

```bash
git add src/components/session/SessionAnnotationToolbar.tsx
git commit -m "feat: add capture and record controls to SessionAnnotationToolbar"
```

---

## Task 2: Wire capture state and handlers in SessionStreamPage

**Files:**
- Modify: `src/pages/SessionStreamPage.tsx`

This task adds all the state, handlers, and new JSX (viewer capture bar + SaveSpecimenDialog) to the stream page.

**Step 1: Add imports at the top of SessionStreamPage.tsx**

After the existing imports, add:

```typescript
import { v4 as uuidv4 } from 'uuid';
import SaveSpecimenDialog from '@/components/capture/SaveSpecimenDialog';
import { captureVideoFrame, mergeImages, blobToDataURL } from '@/lib/capture';
import { storage } from '@/lib/storage';
import { useVideoRecorder } from '@/hooks/useVideoRecorder';
import { Specimen } from '@/types/specimen';
import { Camera, Save } from 'lucide-react';
```

**Step 2: Add capture state variables inside the component, after the existing `useState` for sessionInfo**

```typescript
const [capturedImage, setCapturedImage] = useState<string | null>(null);
const [recordedVideo, setRecordedVideo] = useState<Blob | null>(null);
const [showSaveDialog, setShowSaveDialog] = useState(false);
```

**Step 3: Add the useVideoRecorder hook after the existing hooks**

```typescript
const { isRecording, recordingTime, startRecording, stopRecording } = useVideoRecorder();
```

**Step 4: Add handleCapture after the existing navigation handlers**

```typescript
const handleCapture = useCallback(async () => {
  try {
    let baseFrame: string;
    if (isPresenter) {
      if (!videoRef.current) return;
      baseFrame = await captureVideoFrame(videoRef.current);
    } else {
      if (!currentFrame) return;
      baseFrame = currentFrame;
    }
    const annotationImage = exportImage();
    const merged = await mergeImages(baseFrame, annotationImage);
    setCapturedImage(merged);
  } catch (err) {
    console.error('[Capture] Failed:', err);
  }
}, [isPresenter, currentFrame, exportImage]);
```

Note: `videoRef` comes from `useCamera()`, `currentFrame` from `useSessionStream()`, `exportImage` from `useAnnotations()`. All are already destructured above this handler.

**Step 5: Add handleSave**

```typescript
const handleSave = async (data: { name: string; description: string; tags: string[] }) => {
  if (!capturedImage) return;

  let videoDataUrl: string | undefined;
  if (recordedVideo) {
    try {
      videoDataUrl = await blobToDataURL(recordedVideo);
    } catch {
      // Continue without video if conversion fails
    }
  }

  const specimen: Specimen = {
    id: uuidv4(),
    name: data.name,
    description: data.description,
    tags: data.tags,
    capturedAt: new Date(),
    imageUrl: capturedImage,
    videoUrl: videoDataUrl,
    annotations: [],
    syncedToCloud: false,
  };

  await storage.addSpecimen(specimen);
  setCapturedImage(null);
  setRecordedVideo(null);
};
```

**Step 6: Add video recording handlers**

```typescript
const handleStartRecording = async () => {
  const stream = videoRef.current?.srcObject as MediaStream | null;
  if (!stream) return;
  await startRecording(stream);
};

const handleStopRecording = async () => {
  const blob = await stopRecording();
  if (blob.size > 0) setRecordedVideo(blob);
};
```

**Step 7: Update the SessionAnnotationToolbar JSX call**

Find the existing `<SessionAnnotationToolbar ... />` block (near the bottom of the return) and replace it:

```tsx
{isPresenter && (
  <SessionAnnotationToolbar
    drawMode={drawMode}
    brushColor={brushColor}
    brushSize={brushSize}
    canUndo={canUndo}
    onModeChange={setMode}
    onColorChange={(color) => updateBrush(color, undefined)}
    onSizeChange={(size) => updateBrush(undefined, size)}
    onUndo={undo}
    onClear={clearAll}
    captureReady={!!capturedImage}
    canSave={!!capturedImage}
    onCapture={handleCapture}
    onSave={() => setShowSaveDialog(true)}
    isRecording={isRecording}
    recordingTime={recordingTime}
    onStartRecording={handleStartRecording}
    onStopRecording={handleStopRecording}
  />
)}
```

**Step 8: Add the viewer capture bar and SaveSpecimenDialog**

Directly after the closing `</div>` of the main content area (the one with `className="flex-1 flex items-center..."`) and before the presenter toolbar, add:

```tsx
{/* Viewer capture bar */}
{!isPresenter && (
  <div className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-900/95 backdrop-blur border-t border-gray-800">
    <button
      className={`w-9 h-9 rounded-lg flex items-center justify-center relative transition-colors ${
        isPresenterStreaming
          ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
          : 'text-gray-600 cursor-not-allowed'
      }`}
      onClick={handleCapture}
      disabled={!isPresenterStreaming}
      title="Capture current frame"
    >
      <Camera className="w-4 h-4" />
      {capturedImage && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-gray-900" />
      )}
    </button>
    <button
      className={`h-9 px-3 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors ${
        capturedImage
          ? 'bg-blue-600 text-white hover:bg-blue-500'
          : 'text-gray-600 cursor-not-allowed'
      }`}
      onClick={() => setShowSaveDialog(true)}
      disabled={!capturedImage}
    >
      <Save className="w-3.5 h-3.5" />
      Save to Library
    </button>
  </div>
)}

{/* Save specimen dialog — shared by both roles */}
<SaveSpecimenDialog
  open={showSaveDialog}
  onClose={() => setShowSaveDialog(false)}
  onSave={handleSave}
/>
```

**Step 9: Add useCallback import if not already present**

Check the import line at the top — `useCallback` must be in the React import:

```typescript
import { useEffect, useState, useCallback } from 'react';
```

**Step 10: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 11: Commit**

```bash
git add src/pages/SessionStreamPage.tsx
git commit -m "feat: add screenshot capture, save to library, and video recording to session stream"
```

---

## Task 3: Smoke test

**Manual test checklist — no automated tests needed (all logic delegates to already-tested utilities):**

**Presenter:**
1. Open a session as presenter, navigate to stream
2. Start camera — verify video feed appears
3. Draw an annotation (pen or text)
4. Click the Camera button in toolbar → green dot appears on Camera button
5. Click Save → `SaveSpecimenDialog` opens
6. Enter a name and save → dialog closes, green dot disappears
7. Navigate to `/session/:code/library` → specimen appears with annotation merged on frame
8. (Video) Click the Video button → timer appears → draw more annotations → click Stop
9. Click Camera → green dot → Save → dialog includes a video (no visible difference in dialog, but specimen saves with video)
10. Check library — two specimens present

**Viewer:**
1. Open the same session as a viewer in a second browser window
2. Verify a dark bottom bar appears with Camera and Save buttons
3. Camera button is disabled (greyed) until presenter starts streaming — verify
4. Once stream is live: click Camera → green dot on Camera button
5. Click Save to Library → dialog opens → save → specimen in viewer's library
6. Verify viewer's library shows 640×480 frame with presenter's annotations merged

**Step 1: Run the dev server and test manually**

```bash
npm run dev
```

**Step 2: Commit if everything works**

```bash
git add -A
git commit -m "test: verified session capture and save-to-library for presenter and viewer"
```
