# 🚀 Deployment Guide: All-in-One on Render (Frontend + Backend)

This guide walks you through running the complete **ESP8266 RC Car** project directly on **Render**.

---

## Architecture Overview (Single Domain / Zero CORS)

```
       ┌────────────────────────────────────────────────────────┐
       │                Render Web Service                      │
       │         https://your-rc-car.onrender.com               │
       │                                                        │
       │  ┌───────────────────────┐   ┌──────────────────────┐  │
       │  │ Mobile Web Controller │   │ Socket.IO Backend    │  │
       │  │ (Served via Express)  │──►│ (Real-time Relay)    │  │
       │  └───────────────────────┘   └──────────┬───────────┘  │
       └─────────────────────────────────────────┼──────────────┘
                                                 │
                                                 │ WSS (Port 443)
                                                 ▼
                              ┌──────────────────────────────────┐
                              │         ESP8266 RC Car           │
                              │  (WiFi Client + Motor Drivers)   │
                              └──────────────────────────────────┘
```

### Why All-in-One on Render is Best:
- **Same Origin**: Both the controller UI and Socket.IO share the exact same domain (`https://your-app.onrender.com`).
- **Zero CORS / Zero Mixed Content**: No cross-domain blocks between Vercel and Render.
- **Zero Setup in UI**: Open the link on your phone and it turns **ONLINE (Green)** instantly.

---

## Step 1: Render Web Service Configuration

1. Go to your [Render Dashboard](https://dashboard.render.com/).
2. Select your Web Service (`esp8266-rc-server`).
3. Under **Settings**, verify:
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Auto-Deploy**: `Yes`
   - **Health Check Path**: `/health`
4. If you recently pushed new commits, click **Manual Deploy** > **Deploy latest commit** to ensure it's up to date.

---

## Step 2: Open Controller on Your Phone

1. Copy your Render URL:
   `https://your-service.onrender.com`
2. Open it in Chrome, Safari, or Brave on your phone.
3. The controller loads and automatically connects to itself — turning **ONLINE** with a green pulse dot!

> [!TIP]
> Add to Home Screen: In Safari or Chrome, tap **Share** > **Add to Home Screen** to get a 100% full-screen native app experience without browser address bars!

---

## Step 3: Configure ESP8266 Firmware

Open [`esp8266_firmware_example.ino`](esp8266_firmware_example.ino) in Arduino IDE:

```cpp
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Use your live Render Web Service domain:
const char* server_host = "your-service.onrender.com"; 
const int server_port = 443;
const bool use_ssl = true;
```

Flash the board and check the Serial Monitor at `115200` baud. When you press buttons on your phone, you will see real-time commands received:
```text
[SOCKET.IO] Received raw command: FORWARD
[ROBOT] Moving FORWARD
[SOCKET.IO] Received raw command: STOP
[ROBOT] Motors STOPPED
```
