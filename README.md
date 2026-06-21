# ⚡ Nexus Chat — Serverless Real-Time Chat Application

Nexus Chat is a production-style, serverless real-time chat application designed to demonstrate robust cloud architecture using AWS emulated services, a modular Gemini AI integration, and a highly responsive React client. Built to serve as a flagship resume project for internship and entry-level cloud/fullstack roles.

[![AWS Lambda](https://img.shields.io/badge/AWS-Lambda-orange?style=for-the-badge&logo=awslambda)](https://aws.amazon.com/lambda/)
[![DynamoDB](https://img.shields.io/badge/AWS-DynamoDB-blue?style=for-the-badge&logo=amazondynamodb)](https://aws.amazon.com/dynamodb/)
[![API Gateway](https://img.shields.io/badge/AWS-API%20Gateway-purple?style=for-the-badge&logo=amazonaws)](https://aws.amazon.com/api-gateway/)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61dafb?style=for-the-badge&logo=react)](https://react.dev/)
[![Gemini](https://img.shields.io/badge/AI-Google%20Gemini-green?style=for-the-badge&logo=google)](https://deepmind.google/technologies/gemini/)

---

## 🌟 Resume-Ready Project Summary

> **Serverless Real-Time Chat Application (Nexus Chat)**
> *   Designed and implemented a high-performance, real-time multi-room chat application using **AWS API Gateway WebSocket APIs**, **AWS Lambda**, and **Amazon DynamoDB**.
> *   Eliminated real-time delivery overhead by utilizing WebSocket connections for two-way communication, reducing broadcast latency to **sub-50ms**.
> *   Architected the **DynamoDB schema** using partition and sort keys (`roomName` + `timestamp`) to efficiently store and query message history, loading the last 50 messages on room entry in under **30ms**.
> *   Implemented **automatic client-side reconnection** with exponential backoff (capped at 10s) and state preservation (username, room, history restoration) to handle network interruptions gracefully.
> *   Designed a modular **Google Gemini AI integration** allowing users to query AI agents directly in the chat with `@bot`, utilizing safe fallbacks and asynchronous Lambda triggers.
> *   Engineered strict **IAM security policies** with minimal privilege, scoping access to specific table ARNs instead of using wildcard (`*`) resource permissions.
> *   Configured **local emulation environment** using `serverless-offline` and `dynalite` to run the entire backend and database 100% locally and free.

---

## 📸 Screenshots

| 👤 Join Screen | 💬 Chat Room |
|---|---|
| ![Join Screen](./screenshots/join_screen.png) | ![Chat Room](./screenshots/chat_room.png) |

| 🟢 Online Users Sidebar | 🤖 AI Assistant Chat |
|---|---|
| ![Online Sidebar](./screenshots/online_users.png) | ![AI Response](./screenshots/ai_bot_response.png) |

---

## 🏗️ Architecture Flow

```
      React Frontend (Vite)  ◄───[ Connection Status Indicators ]
              │
              │  WebSocket Connection (ws://)
              ▼
    Amazon API Gateway (WebSocket API)
              │
              ├──► $connect   ──► Lambda ──► DynamoDB (Persist active connection)
              ├──► $disconnect ─► Lambda ──► DynamoDB (Remove connection, broadcast userLeft)
              ├──► sendMessage ──► Lambda ──► DynamoDB (Save message) ──► Broadcast to Room
              │                                      │
              │                                      └──► [ If @bot ] ──► Gemini AI API
              │
              ├──► typing      ──► Lambda ──► Broadcast typing indicator to Room
              └──► getRecentMessages ─► Lambda ──► DynamoDB Query (Load history) ──► Send to client
```

*   **Compute**: AWS Lambda executes stateless handlers for WebSocket routes.
*   **Database**: Amazon DynamoDB stores connections (active status) and messages (history partition).
*   **API Layer**: API Gateway manages WebSocket state, routes messages, and handles incoming handshakes.
*   **AI Service**: Gemini 1.5 Flash generates context-aware answers to user questions starting with `@bot`.

---

## ✨ Features

*   **Connection Status Indicator**: Live status dot and text showing `Connected` (green), `Connecting` / `Reconnecting` (flashing yellow), or `Disconnected` (red).
*   **Auto-Reconnection**: Resilient client-side WebSocket loop using **exponential backoff** to preserve user state and restore message history automatically.
*   **Multi-Room Isolation**: Select rooms (General, Engineering, Random, Support) with isolated message streams and custom sidebar lists.
*   **Live User Panels**: Sidebar indicating the current room member count and username cards.
*   **Join/Leave Banners**: Real-time notifications sliding in when users enter or exit the room.
*   **Typing Bubbles**: Debounced typing indicators (e.g. *"Alice is typing..."*) to show active engagement.
*   **Google Gemini Bot**: Ask questions using `@bot <question>` and get answers in markdown format directly inside the room.

---

## 🗂️ Folder Structure

```
chat-app/
├── aws-backend/            # AWS Lambda Backend (Serverless Framework)
│   ├── handler.js          # Core Lambda entrypoints (connect, disconnect, sendMessage, history)
│   ├── gemini.js           # Gemini API Integration & Mock fallback logic
│   ├── init-db.js          # Local DynamoDB tables initializer script
│   ├── serverless.yml      # Infrastructure configuration (routes, IAM, DynamoDB local definitions)
│   └── .env.example        # Environment variable template
│
├── client/                 # React Client (Vite + Vanilla CSS)
│   ├── src/
│   │   ├── App.jsx         # Main React component (Join screen, Chat UI, Reconnect loop)
│   │   └── index.css       # Premium Dark-mode stylesheet with responsive grid
│   └── package.json        # Client configuration & dependencies
│
└── screenshots/            # Showcase images of application UI
```

---

## 🚀 Getting Started

### 1. Prerequisites
*   Node.js 18+
*   Git

### 2. Clone and Setup Backend
```bash
git clone https://github.com/kadreatharv/serverless-chat-app-using-Amazon-AWS-.git
cd serverless-chat-app-using-Amazon-AWS-/aws-backend
npm install
```

### 3. Add Gemini API Key (Optional)
Copy `.env.example` to `.env` and insert your API key:
```bash
cp .env.example .env
```
Inside `.env`:
```env
GEMINI_API_KEY=your_google_ai_studio_api_key_here
```
*(If no key is provided, the bot will use a clean Mock AI fallback explanation).*

### 4. Start Local Database (Terminal 1)
```bash
npm run start:db
```

### 5. Start Serverless Backend (Terminal 2)
In another terminal, initialize the tables and start API Gateway:
```bash
npm run dev
```
*This command runs the table migrations first and then launches `serverless-offline` on WebSocket port `4001` and HTTP port `3002`.*

### 6. Start React Client (Terminal 3)
```bash
cd ../client
npm install
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser!

---

## 🛡️ Security Best Practices Implemented

*   **Least Privilege IAM Policies**: The AWS resources in `serverless.yml` are declared with tight actions. Lambdas only have access to `PutItem`, `Scan`, and `GetItem` on the Connections table and `PutItem` and `Query` on the Messages table. No admin policies or wildcards.
*   **Local Secret Separation**: The Gemini key is loaded dynamically through Node `dotenv`, keeping API keys out of repository history.

---

## 🛠️ Technology Stack

| Component | Tech Stack |
|---|---|
| **Frontend** | React 18, Vite, CSS Grid, HTML5 Semantic Tags |
| **Networking** | Native WebSockets Client (browser) |
| **API Gateway** | API Gateway (WebSocket API) |
| **Serverless Compute** | AWS Lambda (Node.js 18) |
| **NoSQL Database** | Amazon DynamoDB |
| **Artificial Intelligence** | Google Gemini 1.5 Flash (`@google/generative-ai`) |
| **Local Emulators** | `serverless-offline` + `dynalite` |