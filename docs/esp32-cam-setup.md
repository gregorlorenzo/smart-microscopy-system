# ESP32-CAM Setup Guide

## What you need

- ESP32-CAM-MB board (with built-in USB programmer — Micro USB port on the bottom)
- Micro USB cable
- Arduino IDE installed on the PC
- The PC and the microscopy laptop on the **same WiFi network**

---

## Step 1 — Install the ESP32 board package in Arduino IDE

1. Open Arduino IDE → **File > Preferences**
2. In "Additional boards manager URLs" paste:

   ```text
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```

3. Click OK
4. Go to **Tools > Board > Boards Manager**
5. Search `esp32` → Install **"esp32 by Espressif Systems"** (takes a few minutes)

---

## Step 2 — Open the CameraWebServer example

1. **File > Examples > ESP32 > Camera > CameraWebServer**
2. A new sketch opens with several tabs

---

## Step 3 — Configure the sketch

In the main tab (`CameraWebServer.ino`), find the camera model section near the top and **uncomment only this line** (make sure all others are commented out):

```cpp
#define CAMERA_MODEL_AI_THINKER
```

Then set your WiFi credentials (same network the microscopy laptop will be on):

```cpp
const char* ssid = "YourWiFiName";
const char* password = "YourWiFiPassword";
```

---

## Step 4 — CORS header (already done in this project's firmware)

The project's `app_httpd.cpp` already includes:

```cpp
httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
```

on the `/capture`, `/stream`, `/status`, and all other endpoints. **No changes needed.**

> If you ever replace `app_httpd.cpp` with a fresh copy from the Arduino example, add the line above inside `capture_handler` just before `httpd_resp_send`.

---

## Step 5 — Select the board and port

1. **Tools > Board > ESP32 Arduino > AI Thinker ESP32-CAM**
2. **Tools > Port** → select the COM port that appeared when you plugged in the USB (if unsure, unplug/replug and see which port disappears/appears)
3. Leave everything else at defaults

---

## Step 6 — Upload

1. Click the **Upload** button (→ arrow)
2. Wait for "Connecting…" — it should connect automatically with the ESP32-CAM-MB board (no need to hold any buttons)
3. Wait for "Done uploading"

---

## Step 7 — Get the IP address

1. **Tools > Serial Monitor**
2. Set baud rate to **115200** (bottom-right dropdown)
3. Press the **Reset button** on the board (small button on the ESP32-CAM-MB)
4. You'll see output like:

   ```
   WiFi connected
   Camera Ready! Use 'http://192.168.1.105' to connect
   ```

5. Note that IP address — you'll enter it in the app

---

## Step 8 — Use in the app

### Option A — Local access (app opened via `npm run dev`)

1. Open the microscopy app on your PC at `http://localhost:5173`
2. Select **ESP32-CAM**, enter the IP (e.g. `192.168.1.105`), click **Test**

### Option B — Vercel / HTTPS (recommended for shared use)

Browsers block HTTP requests from HTTPS pages (mixed-content policy).  
Use **ngrok** to give the ESP32 a public HTTPS tunnel:

1. Install ngrok once: <https://ngrok.com/download>
2. Before each session, run in a terminal on the same WiFi PC as the ESP32:

   ```
   ngrok http 192.168.1.105:80
   ```

   *(replace IP with whatever the Serial Monitor shows)*
3. ngrok prints a URL like `https://a1b2-etc.ngrok-free.app` — copy it
4. In the Vercel app, select **ESP32-CAM** and paste the **full `https://` URL** into the IP field
5. Click **Test** — should connect
6. Click **Go Live**

> **Note:** The ngrok URL changes every session on the free tier. For a fixed URL, upgrade to ngrok Pro or self-host a tunnel.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Port not showing up | Try a different USB cable (some are charge-only, not data) |
| "Connecting…" hangs forever | Press and hold the **IO0 button** on the board while clicking Upload, release after "Connecting…" appears |
| Test button shows "CORS blocked" | `Access-Control-Allow-Origin` header missing — check `app_httpd.cpp` |
| Test button shows "Mixed-content blocked" | App is on HTTPS (Vercel), ESP32 is HTTP — use ngrok (see Step 8 Option B) |
| Test button shows "Cannot reach ESP32" | Wrong IP or URL, or devices are on different WiFi networks |
| ngrok URL not working | Re-run `ngrok http <ip>:80` and paste the new URL; free tier changes every session |
| Serial Monitor shows garbage characters | Wrong baud rate — set to **115200** |
| No output in Serial Monitor | Press the Reset button on the board after opening the monitor |
