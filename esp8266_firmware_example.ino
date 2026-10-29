/*
  ESP8266 RC Car Controller Firmware (Clean, Error-Free Compilation)
  
  REQUIRED LIBRARY (Install in Arduino IDE: Sketch -> Include Library -> Manage Libraries):
  - "WebSockets" by Markus Sattler (v2.3.4 or newer)
  
  WIRING (ESP8266 to Motor Driver):
  - IN1: D5 (GPIO14) - Left Motor Forward
  - IN2: D6 (GPIO12) - Left Motor Reverse
  - IN3: D7 (GPIO13) - Right Motor Forward
  - IN4: D8 (GPIO15) - Right Motor Reverse
  - GND: Connect to Motor Driver GND (Common Ground)
*/

#include <ESP8266WiFi.h>
#include <WebSocketsClient.h>

// Wi-Fi Credentials
const char* ssid = "Deepanshu's S23";
const char* password = "11223345";

// Target Server Configuration
// To use Render Cloud:
const char*    server_host = "car-controller.onrender.com";
const uint16_t server_port = 443;
const bool     use_ssl     = true;

// To use Local Server (Uncomment when running locally on PC for lowest latency):
// const char*    server_host = "192.168.1.100"; // Replace with PC LAN IP
// const uint16_t server_port = 3000;
// const bool     use_ssl     = false;

// Motor Pin Definitions
#define IN1 D5
#define IN2 D6
#define IN3 D7
#define IN4 D8

WebSocketsClient webSocket;

// Motor Control Functions
void stopMotors() {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, LOW);
  Serial.println("[ROBOT] Motors STOPPED");
}

void moveForward() {
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, HIGH);
  digitalWrite(IN4, LOW);
  Serial.println("[ROBOT] Moving FORWARD");
}

void moveBackward() {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, HIGH);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, HIGH);
  Serial.println("[ROBOT] Moving BACKWARD");
}

void turnLeft() {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, HIGH);
  digitalWrite(IN3, HIGH);
  digitalWrite(IN4, LOW);
  Serial.println("[ROBOT] Turning LEFT");
}

void turnRight() {
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, HIGH);
  Serial.println("[ROBOT] Turning RIGHT");
}

// WebSocket Event Handler (Parses incoming Socket.IO commands cleanly)
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("[SOCKET] Disconnected! Stopping motors for safety.");
      stopMotors();
      break;

    case WStype_CONNECTED:
      Serial.printf("[SOCKET] Connected to: %s\n", payload);
      break;

    case WStype_TEXT: {
      String msg = String((char*)payload);

      // Handle Engine.IO ping/pong heartbeat (Socket.IO standard)
      if (msg == "2") {
        webSocket.sendTXT("3"); // Respond with pong
        return;
      }

      Serial.printf("[CMD RECEIVED] %s\n", msg.c_str());

      // Parse directional drive commands
      if (msg.indexOf("FORWARD") >= 0) {
        moveForward();
      } else if (msg.indexOf("BACKWARD") >= 0) {
        moveBackward();
      } else if (msg.indexOf("LEFT") >= 0) {
        turnLeft();
      } else if (msg.indexOf("RIGHT") >= 0) {
        turnRight();
      } else if (msg.indexOf("STOP") >= 0) {
        stopMotors();
      }
      break;
    }

    default:
      break;
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n--- ESP8266 RC Car Starting ---");

  // Initialize motor control pins as outputs
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);
  stopMotors();

  // Connect to Wi-Fi
  Serial.printf("Connecting to Wi-Fi: %s ", ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");
  Serial.print("ESP8266 IP Address: ");
  Serial.println(WiFi.localIP());

  // Connect to Socket.IO backend on Render or Local
  const char* socketPath = "/socket.io/?EIO=4&transport=websocket";
  if (use_ssl) {
    Serial.printf("Connecting via SSL (WSS) to https://%s:%d%s\n", server_host, server_port, socketPath);
    webSocket.beginSSL(server_host, server_port, socketPath);
  } else {
    Serial.printf("Connecting via WS to http://%s:%d%s\n", server_host, server_port, socketPath);
    webSocket.begin(server_host, server_port, socketPath);
  }

  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(2000); // Auto-reconnect if dropped
}

void loop() {
  webSocket.loop();
}
