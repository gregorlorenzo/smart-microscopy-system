# Laptop Setup Guide — Smart Microscopy System

> For setting up the app on a **fresh Windows laptop** with no existing tools installed.
> Also covers how to change the ESP32-CAM WiFi password and how to run the app day-to-day.

---

## Part 1 — One-Time Setup (Fresh Laptop)

### Step 1 — Install Node.js

Node.js is the runtime that lets you run the app. It includes `npm`, the package manager.

1. Open a browser and go to: **https://nodejs.org**
2. Click the big **"LTS"** download button (the one labeled "Recommended for most users")
3. Run the installer — click **Next** through everything, keep all defaults
4. When it asks about "Tools for Native Modules", you can **leave it unchecked**
5. Finish the install

**Verify it worked:** Open the Start menu, search for **"Command Prompt"**, open it, and type:
```
node --version
```
You should see something like `v22.x.x`. If you do, Node is installed.

---

### Step 2 — Install Git

Git is used to download and manage the project code.

1. Go to: **https://git-scm.com/download/win**
2. The download starts automatically — run the installer
3. Click **Next** through everything, keep all defaults
4. Finish the install

**Verify it worked:** Open a new Command Prompt and type:
```
git --version
```
You should see something like `git version 2.x.x`.

---

### Step 3 — Download the Project Code

#### Option A — Clone with Git (recommended, easier to update later)

1. Open Command Prompt
2. Navigate to where you want the folder (e.g., your Desktop):
   ```
   cd Desktop
   ```
3. Clone the repository (replace `<repo-url>` with the actual GitHub URL):
   ```
   git clone <repo-url>
   ```
4. This creates a `smart-microscopy-system` folder on your Desktop

#### Option B — Download as ZIP (no Git account needed)

1. Go to the project's GitHub page
2. Click the green **Code** button → **Download ZIP**
3. Extract the ZIP to your Desktop (right-click → "Extract All")
4. You'll have a folder like `smart-microscopy-system-main`

---

### Step 4 — Install Dependencies (first time only)

This downloads all the libraries the app needs. You only do this once.

1. Open Command Prompt
2. Navigate into the project folder:
   ```
   cd Desktop\smart-microscopy-system
   ```
   *(If you downloaded the ZIP, the folder might be named `smart-microscopy-system-main`)*
3. Run:
   ```
   npm install
   ```
4. Wait — this takes 1–3 minutes and prints a lot of text. It's done when you see the prompt (`>`) return.

---

## Part 2 — Running the App (Every Time)

### Start the App

1. Open Command Prompt
2. Navigate to the project folder:
   ```
   cd Desktop\smart-microscopy-system
   ```
3. Run:
   ```
   npm run dev
   ```
4. You'll see output like this:
   ```
     VITE v5.x.x  ready in 500ms

     ➜  Local:   http://localhost:5173/
     ➜  Network: http://192.168.1.45:5173/
   ```

### Share with Viewers

- **Your laptop:** Open `http://localhost:5173` in your browser
- **Other devices (phones, tablets, other laptops):** Open the **Network URL** — the one starting with `http://192.168.x.x:5173`

> **Important:** Everyone must be connected to the **same WiFi network** as your laptop. This is required for both viewers to join the session AND for the app to communicate with the ESP32-CAM.

### Stop the App

Press `Ctrl + C` in the Command Prompt window.

---

## Part 3 — Connecting the ESP32-CAM

1. Plug the ESP32-CAM-MB into the laptop via Micro USB
2. Make sure the ESP32-CAM is powered on and connected to the **same WiFi** as the laptop
3. The ESP32's IP address was shown in the Serial Monitor when it was first set up (e.g., `192.168.1.105`)
4. In the app, go to the Microscope view → select **ESP32-CAM** as the camera source
5. Enter the IP address → click **Test** → then **Go Live**

> If you don't know the ESP32's IP address, see Part 4 below to re-flash it and check the Serial Monitor output.

---

## Part 4 — Changing the ESP32-CAM WiFi Credentials

Do this whenever you need to connect the ESP32-CAM to a **different WiFi network** (e.g., the presentation venue has a different network than your lab).

### What you need
- The laptop with Arduino IDE installed (see below if not installed)
- A Micro USB cable (data cable, not charge-only)
- The ESP32-CAM-MB board

### Step 1 — Install Arduino IDE (if not already installed)

1. Go to: **https://www.arduino.cc/en/software**
2. Click **"Windows Win 10 and newer, 64 bits"** download
3. Run the installer, keep all defaults, finish

### Step 2 — Install the ESP32 Board Package

*(Skip this if it was done before on this laptop.)*

1. Open Arduino IDE
2. Go to **File → Preferences**
3. In the "Additional boards manager URLs" box, paste:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Click **OK**
5. Go to **Tools → Board → Boards Manager**
6. Search for `esp32` → install **"esp32 by Espressif Systems"** (this takes a few minutes)

### Step 3 — Open the Firmware

The project's firmware is based on the ESP32 CameraWebServer example with custom additions. To find it:

1. In Arduino IDE: **File → Examples → ESP32 → Camera → CameraWebServer**
2. A new sketch window opens with multiple tabs at the top

### Step 4 — Update the WiFi Credentials

1. Click the main tab named **`CameraWebServer`** (or `CameraWebServer.ino`)
2. Near the top of the file, find these two lines:
   ```cpp
   const char* ssid = "YourWiFiName";
   const char* password = "YourWiFiPassword";
   ```
3. Replace the values with the new WiFi name and password:
   ```cpp
   const char* ssid = "AdviserOfficeWiFi";
   const char* password = "correctpassword123";
   ```
   > Keep the quotes (`"`) around the values. Only change what's inside them.

4. Also confirm that the camera model line near the top is set correctly (only this one should be uncommented):
   ```cpp
   #define CAMERA_MODEL_AI_THINKER
   ```

### Step 5 — Select the Board and Port

1. Plug the ESP32-CAM-MB into the laptop via Micro USB
2. **Tools → Board → ESP32 Arduino → AI Thinker ESP32-CAM**
3. **Tools → Port** → select the COM port that appeared (e.g., `COM3` or `COM4`)
   - If unsure which port, unplug the USB, note which ports are listed, then replug and see which new one appears

### Step 6 — Upload

1. Click the **Upload** button (the right-arrow → icon in the toolbar)
2. Wait for "Connecting…" — it should connect automatically
3. Wait for **"Done uploading"** — this takes about 30–60 seconds

### Step 7 — Get the New IP Address

1. **Tools → Serial Monitor**
2. Set the baud rate to **115200** (bottom-right dropdown in the Serial Monitor)
3. Press the **Reset button** on the ESP32-CAM-MB board (small button)
4. Watch the output — after a few seconds you'll see:
   ```
   WiFi connected
   Camera Ready! Use 'http://192.168.x.x' to connect
   ```
5. Note the IP address — you'll enter this in the app

---

## Part 5 — Day-to-Day Checklist

Before each presentation:

- [ ] Laptop and ESP32-CAM are on the **same WiFi network**
- [ ] Open Command Prompt → `cd Desktop\smart-microscopy-system` → `npm run dev`
- [ ] Note the **Network URL** from the terminal output
- [ ] Share the Network URL with viewers (write it on the board, share via chat, etc.)
- [ ] In the app, connect to the ESP32-CAM using its IP address

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm` is not recognized | Restart Command Prompt after installing Node.js |
| `npm install` fails with errors | Check internet connection; try again |
| `npm run dev` shows only `Local:` URL, no `Network:` | Windows Firewall may be blocking; allow Node.js through the firewall when prompted |
| Viewers can't open the Network URL | Make sure they're on the same WiFi; try disabling laptop's firewall temporarily |
| App opens but camera shows "Cannot reach ESP32" | Wrong IP address, or ESP32 is on a different WiFi network |
| ESP32 Serial Monitor shows garbage characters | Wrong baud rate — set to **115200** |
| "Connecting…" hangs forever during upload | Press and hold the **IO0 button** on the board while clicking Upload, release after "Connecting…" appears |
| COM port not showing in Arduino IDE | Try a different USB cable (some cables are charge-only, not data) |
