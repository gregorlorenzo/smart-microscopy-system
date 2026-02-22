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
   ```
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

## Step 4 — Add the CORS header (one line change)

Open the `app_httpd.cpp` tab. Search (`Ctrl+F`) for `capture_handler`.

Find the line that says `httpd_resp_send` inside that function. Just above it, add:

```cpp
httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
```

It should look like this after the change:

```cpp
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");   // ← add this
  httpd_resp_send(req, (const char *)jpg_buf, jpg_buf_len);
```

> **Why this is needed:** Without this header the browser blocks JavaScript from reading the image data, even though the image itself displays fine. This is the most common reason the Test button fails.

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

1. Open the microscopy app and create a session as presenter
2. On the **Camera Setup** screen, select **ESP32-CAM**
3. Enter the IP address (e.g. `192.168.1.105`)
4. Click **Test** — should show green "Connected"
5. Click **Go Live**

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Port not showing up | Try a different USB cable (some are charge-only, not data) |
| "Connecting…" hangs forever | Press and hold the **IO0 button** on the board while clicking Upload, release after "Connecting…" appears |
| Test button shows CORS error | The `httpd_resp_set_hdr` line wasn't added, or was added in the wrong place in `app_httpd.cpp` |
| Test button shows "Cannot reach ESP32" | Wrong IP, or the PC and ESP32 are on different WiFi networks |
| Serial Monitor shows garbage characters | Wrong baud rate — set to **115200** |
| No output in Serial Monitor | Press the Reset button on the board after opening the monitor |
