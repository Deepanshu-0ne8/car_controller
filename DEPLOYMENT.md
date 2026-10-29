# 🚀 Deployment Guide: Render (Backend) + Vercel (Frontend)

This guide walks you through deploying the **ESP8266 RC Car** project with the **WebSocket Backend on Render** and the **Web Controller Frontend on Vercel**.

---

## Architecture Overview

```
                      ┌───────────────────────────────────────┐
                      │          Vercel (Frontend)            │
                      │  https://your-rc-car.vercel.app       │
                      └──────────────────┬────────────────────┘
                                         │
                                         │ Socket.IO / WSS
                                         ▼
                      ┌───────────────────────────────────────┐
                      │          Render (Backend)             │
                      │  https://your-rc-car.onrender.com     │
                      └──────────────────▲────────────────────┘
                                         │
                                         │ Socket.IO / WSS
                                         ▼
                      ┌───────────────────────────────────────┐
                      │          ESP8266 RC Car               │
                      │   (WiFi Client + Motor Drivers)       │
                      └───────────────────────────────────────┘
```

---

## Part 1: Deploy Backend to Render

Render hosts the persistent Node.js + Socket.IO server.

### Step 1: Push Code to GitHub
Ensure your repository is pushed to your GitHub/GitLab account:
```bash
git init
git add .
git commit -m "ESP8266 RC Car Controller with Render & Vercel deployment configs"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

### Step 2: Create Web Service on Render
1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** > **Web Service**.
2. Connect your GitHub repository.
3. Configure the settings:
   - **Name**: `esp8266-rc-server` (or any name you prefer)
   - **Region**: Choose the closest region to your physical location (e.g., Oregon, Ohio, Frankfurt, Singapore) for lowest latency.
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`
4. Expand **Advanced** and set:
   - **Health Check Path**: `/health`
   - **Auto-Deploy**: `Yes`
5. Click **Create Web Service**.

> [!NOTE]
> Alternatively, Render automatically detects the [`render.yaml`](render.yaml) file in this repository if you choose **New +** > **Blueprint**.

### Step 3: Copy Your Render URL
Once deployed, copy your service URL from the Render header:
`https://your-rc-server.onrender.com`

---

## Part 2: Deploy Frontend to Vercel

Vercel provides ultra-fast global CDN hosting for the mobile controller interface.

### Step 1: Import Repository on Vercel
1. Go to [Vercel Dashboard](https://vercel.com/) and click **Add New...** > **Project**.
2. Import the same GitHub repository.
3. Configure the Project:
   - **Framework Preset**: `Other` (Static HTML)
   - **Root Directory**: `./` (Default)
   - **Build and Output Settings**: Leave defaults (the [`vercel.json`](vercel.json) file automatically configures clean URLs and CORS headers).
4. Click **Deploy**.

### Step 2: Connect Frontend to Your Render Backend
1. Open your live Vercel URL: `https://your-rc-car.vercel.app`
2. Tap the **⚙️ (Settings Gear)** icon in the top-right corner.
3. Paste your Render backend URL (e.g., `https://your-rc-server.onrender.com`).
4. Click **Save & Connect**.
5. The connection badge will turn green (**ONLINE**) with live latency tracking!

> [!TIP]
> The backend URL is saved to your browser's `localStorage`, so you only need to configure it once.

---

## Part 3: Handling Render Free Tier Cold Starts

On Render's free tier, servers sleep after 15 minutes of inactivity:
- When you first open the controller on your phone after a break, the server may take **30 to 45 seconds** to boot.
- The controller will display an amber banner: *"Render free tier is waking up (~30-45s)..."*.
- To keep the server awake during an active session or demo, you can ping `https://your-rc-server.onrender.com/health` using a free uptime monitor like [UptimeRobot](https://uptimerobot.com/) or [Cron-Job.org](https://cron-job.org/) every 10 minutes.

---

## Part 4: Update ESP8266 Firmware

Open [`esp8266_firmware_example.ino`](esp8266_firmware_example.ino) in Arduino IDE:

1. Update your Wi-Fi credentials:
   ```cpp
   const char* ssid = "YOUR_WIFI_SSID";
   const char* password = "YOUR_WIFI_PASSWORD";
   ```
2. Set the connection host:
   - **For Cloud Control via Render (Internet / 4G / 5G)**:
     ```cpp
     const char* server_host = "your-rc-server.onrender.com";
     const int server_port = 443;
     const bool use_ssl = true;
     ```
   - **For Local Control (Home Wi-Fi LAN / Zero Internet Latency)**:
     ```cpp
     const char* server_host = "192.168.1.100"; // Your PC's LAN IP
     const int server_port = 3000;
     const bool use_ssl = false;
     ```
3. Flash the code to your NodeMCU / ESP8266 board.
4. Open the Serial Monitor (115200 baud) to verify connection.

---

## Verification Checklist

| Check | Item | Expected Result |
| :---: | :--- | :--- |
| ✅ | Render Health Check | `curl https://<your-render-url>/health` returns `{"status":"healthy"}` |
| ✅ | Vercel Frontend | Opens full screen with dark theme, no pull-to-refresh, no zoom |
| ✅ | Dead-Man Switch | Lifting thumb immediately sends `STOP` and turns the active HUD red |
| ✅ | Cross-Origin Socket | Latency badge displays live round-trip ping time (e.g., `25-60 ms`) |

