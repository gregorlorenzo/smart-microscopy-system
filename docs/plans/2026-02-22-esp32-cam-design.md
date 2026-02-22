# ESP32-CAM Integration Design

**Date:** 2026-02-22
**Status:** Approved

## Overview

Allow the session presenter to stream from an ESP32-CAM module (connected via local WiFi) in addition to the existing webcam/phone camera. Viewers receive frames identically regardless of source.

## Context

- App runs locally via `npm run dev` (HTTP — no mixed-content issue)
- Students have the **ESP32-CAM-MB** board (built-in USB programmer, no FTDI wiring needed)
- Only the presenter needs any setup; viewers just open a URL
- Supabase realtime broadcast is unchanged — viewers still receive JPEG frames the same way

## Architecture

```
SessionStreamPage
  ├─ [Setup screen] ── choose: webcam | ESP32-CAM
  │
  ├─ webcam path (unchanged)
  │    useCamera → videoRef → broadcastFrame(videoRef.current)
  │
  └─ esp32 path (new)
       useEspCamera(ip) → currentFrame (Blob URL, polled every 500ms)
                       → broadcastImage(currentFrame) → Supabase → viewers
```

Viewers receive frames identically regardless of source.

## Components

### 1. `useEspCamera` hook (new — `src/hooks/useEspCamera.ts`)

```typescript
interface UseEspCameraOptions {
  ip: string;
  enabled: boolean;
}

interface UseEspCameraResult {
  currentFrame: string | null;   // Blob URL, updated every 500ms when active
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  testConnection: (ip: string) => Promise<boolean>;
}
```

**`testConnection(ip)`**
- `GET http://{ip}/capture` with 3-second AbortSignal timeout
- Returns `true` if response is ok and Content-Type is `image/jpeg`
- Sets `isConnected` accordingly

**Frame polling** (when `enabled=true`)
- `setInterval` at 500ms
- `fetch('http://{ip}/capture')` → `response.blob()` → `URL.createObjectURL(blob)`
- Sets `currentFrame` to new Blob URL
- Revokes previous Blob URL immediately to prevent memory leaks
- On fetch error: sets `error`, sets `isConnected = false`

**Cleanup**
- `clearInterval` on disable/unmount
- `URL.revokeObjectURL(currentFrame)` on last frame

### 2. `useSessionStream` — add `broadcastImage` (`src/hooks/useSessionStream.ts`)

New exported function alongside existing `broadcastFrame`:

```typescript
broadcastImage(dataUrl: string): void
```

- Draws `dataUrl` onto an 800×600 offscreen canvas with center-crop
  (same logic as `broadcastFrame` — ensures annotation coordinate alignment)
- `offscreen.toDataURL('image/jpeg', JPEG_QUALITY)`
- Sends via `channel.send({ type: 'broadcast', event: 'frame', payload: { frame } })`

### 3. `SessionStreamPage` — setup screen + ESP32 path (`src/pages/SessionStreamPage.tsx`)

**New state:**
```typescript
type CameraSource = 'webcam' | 'esp32';
const [isLive, setIsLive] = useState(false);          // false = setup screen
const [cameraSource, setCameraSource] = useState<CameraSource>('webcam');
const [espIp, setEspIp] = useState('');
```

**Setup screen** (shown when `isPresenter && !isLive`):
```
┌────────────────────────────────────────────────┐
│  ← Back    [Session Name]     [Participants]   │
├────────────────────────────────────────────────┤
│                                                │
│            Camera Setup                        │
│                                                │
│   ○  Webcam / phone camera                     │
│   ●  ESP32-CAM                                 │
│         IP: [ 192.168.1.105  ]  [ Test ]       │
│              ✓ Connected                       │
│                                                │
│   ┌──────────────────────────────────────┐     │
│   │       Live preview (800×600)         │     │
│   └──────────────────────────────────────┘     │
│                                                │
│              [     Go Live     ]               │
└────────────────────────────────────────────────┘
```

- "Go Live" disabled until: webcam is streaming OR ESP32 `isConnected=true`
- Clicking "Go Live" sets `isLive = true`, transitions to existing stream UI

**Broadcasting while live:**
- Webcam: `startBroadcasting(videoRef.current)` — unchanged
- ESP32: `useEffect` watches `currentEspFrame`; on each new frame calls `broadcastImage(currentEspFrame)`

**Presenter display while live:**
- Webcam: existing `<video>` element — unchanged
- ESP32: `<img src={currentEspFrame} style={{ width: CANVAS_W, height: CANVAS_H }} />`

**Presenter capture (camera icon):**
- Webcam: `captureVideoFrame(videoRef.current)` — unchanged
- ESP32: use `currentEspFrame` directly as the base image (it's already a snapshot)

## ESP32 Firmware Change (one line)

In `app_httpd.cpp` inside the Arduino `CameraWebServer` example, add to `capture_handler` before `httpd_resp_send`:

```cpp
httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
```

This allows the browser to read pixel data from the ESP32's HTTP response. Without it, the browser blocks JS access even though the image displays fine.

**Student setup steps:**
1. Plug ESP32-CAM-MB into USB
2. Open Arduino IDE → File > Examples > ESP32 > Camera > CameraWebServer
3. Uncomment `#define CAMERA_MODEL_AI_THINKER`
4. Set WiFi SSID and password
5. In `app_httpd.cpp`, add the CORS line to `capture_handler`
6. Upload → open Serial Monitor (115200 baud) → note the IP address

## Error Handling

| Scenario | Behaviour |
|---|---|
| `testConnection` timeout / network error | Show "Cannot reach ESP32. Check IP and confirm same WiFi." |
| CORS blocked (missing firmware change) | Show "ESP32 needs CORS header. Add: `httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");` to capture_handler in app_httpd.cpp" |
| Frame polling drops mid-session | Red dot indicator, retry automatically every 2s |
| IP field empty | "Test" and "Go Live" buttons remain disabled |

## Files Changed

| File | Change |
|---|---|
| `src/hooks/useEspCamera.ts` | New |
| `src/hooks/useSessionStream.ts` | Add `broadcastImage(dataUrl)` |
| `src/pages/SessionStreamPage.tsx` | Setup screen + ESP32 camera path |

## Out of Scope

- Standalone mode (can be extended later using the same `useEspCamera` hook)
- HTTPS deployment with ESP32 (would require ngrok — deferred)
- MJPEG stream (snapshot polling at 2fps matches our broadcast rate; smoother stream is not needed for static microscopy specimens)
