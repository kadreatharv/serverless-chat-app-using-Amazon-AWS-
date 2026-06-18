# ⚡ Nexus Chat — Serverless Real-Time Chat Application

A production-style, serverless real-time chat application built to demonstrate AWS cloud architecture for internship and resume projects.

![Architecture](https://img.shields.io/badge/AWS-Lambda-orange?style=for-the-badge&logo=awslambda)
![DynamoDB](https://img.shields.io/badge/AWS-DynamoDB-blue?style=for-the-badge&logo=amazondynamodb)
![API Gateway](https://img.shields.io/badge/AWS-API%20Gateway-purple?style=for-the-badge&logo=amazonaws)
![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61dafb?style=for-the-badge&logo=react)

---

## 🏗️ Architecture

```
React Frontend (Vite)
        │
        │  WebSocket (ws://)
        ▼
Amazon API Gateway (WebSocket API)
        │
        ├──► $connect   → Lambda → DynamoDB (save connectionId + username + room)
        ├──► $disconnect → Lambda → DynamoDB (remove connectionId, broadcast userLeft)
        ├──► sendMessage → Lambda → DynamoDB (persist message, broadcast to room)
        ├──► typing      → Lambda → broadcast typing event to room
        └──► getRecentMessages → Lambda → DynamoDB Query → return last 50 messages
```

> **Runs 100% locally using free emulators — no AWS account required!**
> - `serverless-offline` emulates API Gateway + Lambda
> - `dynalite` emulates DynamoDB (pure Node.js, no Java needed)

---

## ✨ Features

| Feature | Description |
|---|---|
| 👤 **Usernames** | Choose your display name before entering |
| 🏠 **Multi-Room Chat** | General, Engineering, Random, Support |
| 💾 **Message History** | Last 50 messages loaded from DynamoDB on join |
| 🟢 **Online Users Panel** | Live sidebar showing who is in the room |
| 🔔 **Join/Leave Notifications** | Real-time banners when users enter or exit |
| ⌨️ **Typing Indicators** | Animated "User is typing…" bubbles |
| 🤖 **Gemini AI Bot** | Type `@bot <question>` for AI responses |
| 📱 **Responsive Design** | Works on mobile (sidebar collapses) |

---

## 🗂️ Project Structure

```
chat-app/
├── aws-backend/          # Serverless backend (Lambda functions)
│   ├── handler.js        # All Lambda handlers (connect, disconnect, sendMessage, typing, history)
│   ├── serverless.yml    # AWS infrastructure config (API Gateway routes, DynamoDB tables, IAM)
│   ├── init-db.js        # Creates local DynamoDB tables
│   └── .env.example      # Environment variable template
│
└── client/               # React + Vite frontend
    └── src/
        ├── App.jsx        # Main app (Join screen, Chat UI, Online Users sidebar)
        └── index.css      # Premium dark mode CSS
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/kadreatharv/serverless-chat-app-using-Amazon-AWS-.git
cd serverless-chat-app-using-Amazon-AWS-
```

### 2. Setup the Backend
```bash
cd aws-backend
npm install

# (Optional) Add your Gemini API key for real AI responses
cp .env.example .env
# Edit .env and add: GEMINI_API_KEY=your_key_here
```

### 3. Start the Local DynamoDB (Terminal 1)
```bash
cd aws-backend
npm run start:db
```

### 4. Start the Serverless Backend (Terminal 2)
```bash
cd aws-backend
npm run dev
```

### 5. Start the React Frontend (Terminal 3)
```bash
cd client
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🤖 AI Bot Usage

Type `@bot` followed by your question in any chat room:

```
@bot Explain AWS Lambda in simple terms
@bot What is DynamoDB?
@bot How do WebSockets work?
```

> Add your `GEMINI_API_KEY` to `aws-backend/.env` to get real AI responses from Google Gemini.

---

## 🔐 IAM Security Design

Each Lambda function has **minimal privilege** IAM permissions:
- `ConnectionsTable` — only `PutItem`, `DeleteItem`, `Scan`, `GetItem`
- `MessagesTable` — only `PutItem`, `Query`
- No wildcard (`*`) resource permissions

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Real-time | WebSocket (native browser API) |
| Compute | AWS Lambda (Node.js 18) |
| API | Amazon API Gateway (WebSocket) |
| Database | Amazon DynamoDB |
| AI | Google Gemini 1.5 Flash |
| Local Emulation | serverless-offline + dynalite |

---

## 👨‍💻 Author

**Atharv Kadre** — Built as an internship project showcasing AWS Serverless architecture.