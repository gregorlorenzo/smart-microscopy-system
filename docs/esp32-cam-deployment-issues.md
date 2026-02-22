# ESP32-CAM Deployment: Issues, Limitations & Solutions

> **Date:** February 23, 2026  
> **Context:** Connecting an ESP32-CAM (local HTTP device) to a Vercel-hosted HTTPS web application.

---

## Architecture Overview

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  Browser     │  fetch  │  ESP32-CAM   │  WiFi   │  Local       │
│  (Vercel     │ ──────► │  HTTP :80    │ ◄─────► │  Network     │
│   HTTPS)     │         │  Stream :81  │         │  192.168.x.x │
└──────────────┘         └──────────────┘         └──────────────┘
```

The web app is served over **HTTPS** from Vercel's CDN. The ESP32-CAM runs a basic **HTTP** server on the local WiFi network. The browser sits between them and enforces strict security policies that prevent this connection.

---

## Issues Encountered

### 1. Mixed-Content Block

| | |
|---|---|
| **What** | Browsers block HTTP requests made from HTTPS pages |
| **When** | Vercel app (`https://`) tries to fetch ESP32 (`http://192.168.1.28`) |
| **Error** | `Mixed Content: The page was loaded over HTTPS but requested an insecure resource` |
| **Root cause** | Web security standard — cannot downgrade security context |

> [!IMPORTANT]
> This is a browser-enforced security policy. There is no workaround on the frontend — the request is blocked before it even leaves the browser.

### 2. ngrok CORS Preflight Failure

We used [ngrok](https://ngrok.com) to wrap the ESP32's HTTP server in an HTTPS tunnel.

| | |
|---|---|
| **What** | Custom HTTP headers trigger a CORS preflight `OPTIONS` request |
| **When** | Adding `ngrok-skip-browser-warning` header to bypass ngrok's interstitial |
| **Error** | `Access to fetch has been blocked by CORS policy: Response to preflight request doesn't pass access control check` |
| **Root cause** | The ESP32's `esp_http_server` only registers `HTTP_GET` handlers — it cannot respond to `OPTIONS` requests |

The `ngrok-skip-browser-warning` header is required to bypass ngrok's free-tier interstitial page. But because it's a non-standard header, the browser sends an OPTIONS preflight. The ESP32 has no handler for OPTIONS, so the preflight fails and the actual GET is never sent.

### 3. ngrok Free-Tier Interstitial Page

| | |
|---|---|
| **What** | ngrok injects an HTML warning page on the first browser request |
| **When** | Any first request to an ngrok free-tier URL from a browser |
| **Error** | Response returns `Content-Type: text/html` (the interstitial) instead of `image/jpeg` |
| **Root cause** | ngrok free tier requires users to acknowledge a warning page before proxying requests |

We attempted to bypass the interstitial using:

- `Accept: image/jpeg` header (CORS-safe) — **did not work**, ngrok ignores it
- `ngrok-skip-browser-warning` header — **triggers CORS preflight** (see issue #2)
- Non-browser `User-Agent` via server-side proxy — **worked**, but revealed issue #4

### 4. ESP32 Camera 500 Internal Server Error

| | |
|---|---|
| **What** | The ESP32 returns HTTP 500 when `/capture` is requested |
| **When** | After successfully routing through Vercel proxy → ngrok → ESP32 |
| **Error** | `"Server has encountered an unexpected error"` |
| **Root cause** | Firmware/hardware issue — camera module fails to capture a frame |

Common causes:

- Camera ribbon cable is loose or not fully seated
- PSRAM not enabled in Arduino IDE board settings
- Resolution set too high for available memory
- Camera module needs a power cycle (press reset button on ESP32-CAM)

> [!NOTE]
> This was **not** a web deployment issue. The entire proxy pipeline was working correctly at this point — the ESP32 hardware itself could not capture an image.

---

## Limitations

### ESP32-CAM Hardware

- Basic HTTP server with **no OPTIONS/preflight support**
- No TLS/SSL capability (HTTP only)
- Limited memory — high resolutions cause 500 errors
- Single-threaded request handling — can't serve many concurrent viewers

### Browser Security Model

- **Mixed content** is permanently blocked (HTTPS → HTTP)
- **CORS preflight** is mandatory for non-standard headers
- **Third-party cookies** (SameSite) prevent ngrok session cookies from being sent cross-origin

### ngrok Free Tier

- **Interstitial page** on every new session — cannot be bypassed from browser-side
- **Random URLs** — changes every time ngrok restarts
- **Rate limits** — may throttle high-frequency polling (500ms capture interval)

---

## Solutions

### ✅ Option A — Local Development (Current Approach)

**Best for:** Adviser demos, classroom presentations on the same WiFi.

```bash
git clone <repo-url>
cd smart-microscopy-system
npm install
npm run dev          # Vite serves on http://0.0.0.0:5173
```

| Pros | Cons |
|---|---|
| Zero configuration | Presenter's laptop must run the dev server |
| No CORS / mixed-content issues | Everyone must be on the same WiFi |
| ESP32 direct access via local IP | Not accessible from the internet |
| Viewers join via `http://192.168.x.x:5173` | |

**How viewers connect:**

1. Presenter shares the `Network: http://192.168.x.x:5173` URL from the Vite terminal output
2. Viewers open that URL on their phones/laptops (same WiFi)
3. They join the session and see the live microscope stream

---

### ⬡ Option B — Vercel + Serverless Proxy + ngrok Pro ($8/mo)

**Best for:** Panel presentations, remote access.

We built a Vercel serverless proxy (`/api/esp32-proxy`) that fetches from the ESP32 server-side, bypassing all browser restrictions:

```
Browser → Vercel Proxy (server-side) → ngrok → ESP32
           No CORS ✓  No interstitial ✓
```

**What's needed to make this work:**

1. Fix the ESP32 500 error (hardware/firmware issue)
2. Upgrade to **ngrok Pro** for a static domain (no interstitial, fixed URL)
3. The proxy code is already in the repo: `api/esp32-proxy.ts`

---

### ⬡ Option C — Cloudflare Tunnel (Free, No Interstitial)

**Best for:** Free alternative to ngrok Pro.

[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) provides a free HTTPS tunnel **without** an interstitial page.

```bash
# On a machine on the same WiFi as the ESP32:
cloudflared tunnel --url http://192.168.1.28:80
```

- Free, no interstitial page
- Still requires the Vercel serverless proxy for CORS
- Requires a Cloudflare account (free)
- URL changes per session (paid plan for static domain)

---

### ⬡ Option D — Push Architecture (Production-Grade)

**Best for:** Final production deployment, many concurrent viewers.

Instead of the browser *pulling* frames from the ESP32, the ESP32 *pushes* frames to a cloud server:

```
ESP32 ──push──→ Cloud Server (WebSocket/MQTT) ←──read── Browsers
```

**Implementation:**

1. ESP32 firmware captures frames and POSTs them to a cloud endpoint
2. Cloud server (e.g., Supabase Realtime, AWS IoT, or a small VPS) stores the latest frame
3. Web app subscribes via WebSocket to receive frames in real-time

| Pros | Cons |
|---|---|
| No CORS issues | Requires firmware changes |
| Scales to many viewers | More complex architecture |
| Works from anywhere | Needs a cloud server/VPS |
| No ngrok dependency | Higher latency |

---

### ⬡ Option E — VPS Relay Server ($5/mo)

**Best for:** Full control, reliable long-term deployment.

Run a small relay server on a VPS (DigitalOcean, Linode, etc.):

1. ESP32 pushes frames to the VPS via HTTP POST
2. VPS stores latest frame and serves it to browsers
3. Web app fetches from the VPS (same-origin or proper CORS)

---

## Recommendation

| Scenario | Recommended Option |
|---|---|
| Adviser demo (same room) | **Option A** — Local dev |
| Panel presentation (same WiFi) | **Option A** — Local dev |
| Remote viewers / public access | **Option B** (ngrok Pro) or **Option C** (Cloudflare) |
| Production / thesis final product | **Option D** — Push architecture |

For the current stage of the project (adviser presentation), **Option A (local dev)** is the simplest and most reliable path. The Vercel proxy infrastructure is already built and ready for when the ESP32 hardware issue is resolved and a tunnel solution without interstitial is used.
