# Session Capture & Save to Library — Design

**Date:** 2026-02-22
**Status:** Approved

## Problem

The session stream page (`/session/:code/stream`) has no way to capture specimens or save them to the library. The library page exists and the save infrastructure is complete in standalone mode, but nothing wires them together in session mode.

## Goals

- Presenter can capture a snapshot of the live camera feed (merged with annotations) and save it to their library
- Presenter can record a short video clip and attach it to a saved specimen
- Viewer can capture the current received frame (merged with displayed annotations) and save it to their library
- Cloud sync continues to work automatically — no changes required to sync pipeline
- The live stream is never interrupted by a capture action

## Non-Goals

- Video recording for viewers (no MediaStream available — only JPEG frames are received)
- Sharing specimens between participants through the session
- Changing the cloud sync architecture

## Capture Behaviour

**Silent snapshot** — pressing Capture grabs the current frame and annotation layer in the background without pausing, freezing, or otherwise interrupting the live stream or annotation overlay. The stream continues unaffected for both the presenter and viewers.

## Per-Role Capabilities

| Feature              | Presenter              | Viewer                     |
|----------------------|------------------------|----------------------------|
| Capture screenshot   | Full camera resolution | 640×480 broadcast frame    |
| Annotations merged   | Yes                    | Yes (shows presenter's annotations) |
| Video recording      | Yes (camera MediaStream) | No                        |
| Save to library      | Yes                    | Yes                        |
| Cloud sync           | Automatic (unchanged)  | Automatic (unchanged)      |

## Capture Data Flow

### Presenter
1. `captureVideoFrame(videoRef.current)` → full-res JPEG data URL
2. `exportImage()` from annotation canvas → PNG with transparent background
3. `mergeImages(videoFrame, annotationImage)` → merged JPEG
4. Store merged image in local state → show "ready to save" indicator
5. User opens `SaveSpecimenDialog` → fills name/description/tags → `storage.addSpecimen()`
6. Optional: attach recorded video blob via `useVideoRecorder`

### Viewer
1. `currentFrame` is already a base64 JPEG string in React state (already received — zero extra network cost)
2. `exportImage()` from annotation canvas → annotation layer PNG
3. `mergeImages(currentFrame, annotationImage)` → merged JPEG
4. Same save flow as presenter (steps 4–5 above; no video)

## UI Changes

### Presenter bottom toolbar
The existing `SessionAnnotationToolbar` gains two new sections on the right side:
- **Camera icon button** — triggers capture; shows a small "1 frame ready" badge after capture
- **Save to Library button** — enabled after capture; opens `SaveSpecimenDialog`
- **Record button** (`VideoRecordButton`) — start/stop recording; timer shown while recording

### Viewer bottom bar
A new minimal dark bottom bar appears (same height/style as presenter toolbar):
- **Camera icon button** — same capture behaviour
- **Save to Library button** — enabled after capture

The viewer's bar is rendered only when `!isPresenter`.

## Components & Files

### Reused as-is (zero changes)
- `src/components/capture/SaveSpecimenDialog.tsx`
- `src/components/capture/VideoRecordButton.tsx`
- `src/hooks/useVideoRecorder.ts`
- `src/lib/capture.ts` — `captureVideoFrame`, `mergeImages`, `downloadImage`
- `src/lib/storage.ts` — `storage.addSpecimen`
- `src/lib/sync.ts` — entire sync pipeline

### Modified
- `src/components/session/SessionAnnotationToolbar.tsx`
  - Add capture button, "ready" badge, Save button, VideoRecordButton to right side
  - New props: `onCapture`, `onSave`, `canSave`, `isRecording`, `recordingTime`, `onStartRecording`, `onStopRecording`

- `src/pages/SessionStreamPage.tsx`
  - Add capture state: `capturedImage`, `recordedVideo`, `showSaveDialog`
  - Add `useVideoRecorder` hook (presenter only)
  - Wire `handleCapture`, `handleSave` handlers
  - Render viewer bottom bar when `!isPresenter`

## State Added to SessionStreamPage

```typescript
const [capturedImage, setCapturedImage] = useState<string | null>(null);
const [recordedVideo, setRecordedVideo] = useState<Blob | null>(null);
const [showSaveDialog, setShowSaveDialog] = useState(false);
```

## No Changes Required

- Cloud sync pipeline (`sync.ts`, `storage.ts`) — specimens saved via `storage.addSpecimen()` are automatically picked up by the existing sync
- `SaveSpecimenDialog` — already generic, works for session mode
- `useVideoRecorder` — already accepts any `MediaStream`; presenter passes `streamRef.current` from `useCamera`
