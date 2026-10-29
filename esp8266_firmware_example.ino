/*
  ESP8266 RC Car - Socket.IO Receiver Client
  
  Dependencies:
  - WebSockets by Markus Sattler (v2.3.4+)
  - SocketIoClient (or ArduinoJson)
  
  Wiring for typical L298N / TB6612FNG Motor Driver:
  - IN1: D1 (GPIO5) - Left Motor Forward
  - IN2: D2 (GPIO4) - Left Motor Reverse
  - IN3: D5 (GPIO14) - Right Motor Forward
  - IN4: D6 (GPIO12) - Right Motor Reverse
  - ENA & ENB: Connected to PWM pins (D7, D8) or jumpered to 5V
*/

#include <ESP8266WiFi.h>
#include <SocketIoClient.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Choose connection target:
// OPTION A: Local Server (Default for lowest latency testing)
const char* server_host = "192.168.1.100"; 
const int server_port = 3000;
const bool use_ssl = false;

// OPTION B: Render Cloud Server (Remote control over cellular/internet)
// const char* server_host = "your-app-name.onrender.com"; 
// const int server_port = 443;
// const bool use_ssl = true;

// Motor Pin Definitions
// Motor Pin Definitions (Updated for our build)
#define IN1 D5
#define IN2 D6
#define IN3 D7
#define IN4 D8

SocketIoClient webSocket;

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

// Handler for incoming commands from web controller
void onCommand(const char* payload, size_t length) {
  String cmd = String(payload);
  Serial.printf("[SOCKET.IO] Received raw command: %s\n", payload);

  // If receiving shorthand string event: "FORWARD", "STOP", etc.
  if (cmd.indexOf("FORWARD") >= 0) {
    moveForward();
  } else if (cmd.indexOf("BACKWARD") >= 0) {
    moveBackward();
  } else if (cmd.indexOf("LEFT") >= 0) {
    turnLeft();
  } else if (cmd.indexOf("RIGHT") >= 0) {
    turnRight();
  } else {
    stopMotors();
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);

  // Initialize motor pins
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);
  stopMotors();

  // Connect to WiFi
  Serial.printf("Connecting to %s ", ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\nConnected! ESP8266 IP: %s\n", WiFi.localIP().toString().c_str());

  // Configure Socket.IO event listeners
  webSocket.on("cmd", onCommand);
  webSocket.on("car_command", onCommand);

  // Connect to Node.js server (HTTP or HTTPS/WSS)
  if (use_ssl) {
    webSocket.beginSSL(server_host, server_port);
    Serial.printf("Connecting to Secure Cloud Socket.IO at wss://%s:%d...\n", server_host, server_port);
  } else {
    webSocket.begin(server_host, server_port);
    Serial.printf("Connecting to Local Socket.IO at ws://%s:%d...\n", server_host, server_port);
  }
}

void loop() {
  webSocket.loop();
}

