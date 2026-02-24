# TatheerApp — Real-Time WebSocket Chat App

A full-featured, WhatsApp-like real-time chat application built with **React** (frontend) and **Express** (backend), powered by **Socket.io** for instant messaging.

## Features

- **Two main screens:**
  1. **Chat List Screen** — Browse conversations, search, filter (All/Unread/Groups/Direct), see online users
  2. **Chat Conversation Screen** — Full chat view with messages, typing indicators, reactions, replies

- **Real-time messaging** via WebSocket (Socket.io)
- **Direct messages** and **group chats**
- **Typing indicators**, **read receipts**, **message reactions**
- **Reply to messages**, **edit** and **delete** your own messages
- **Emoji picker** for messages
- **Responsive design** — split view on desktop, single-screen navigation on mobile
- **Email registration** — Create account with email + OTP verification (EmailJS)
- **Voice & video calls** — WebRTC-based 1:1 calls

## Tech Stack

- **Frontend:** React 18, Vite, React Router, Socket.io Client, Lucide React
- **Backend:** Express, Socket.io, Mongoose, MongoDB Atlas

## Getting Started

### 1. Install dependencies

```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install
```

### 2. Run the app

**Terminal 1 — Backend:**
```bash
cd backend
npm start
# or: npm run dev  (with nodemon)
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

### 3. MongoDB Atlas (required)

Add your connection string to `backend/.env`:

1. Create a free cluster at [MongoDB Atlas](https://cloud.mongodb.com/)
2. Get your connection string (Connect → Drivers → Node.js)
3. Copy `backend/.env.example` to `backend/.env` and add:
   ```
   MONGODB_URI=mongodb+srv://youruser:yourpassword@cluster.xxxxx.mongodb.net/tatheerapp?retryWrites=true&w=majority
   ```
Replace `youruser`, `yourpassword`, and cluster URL with your actual credentials.

### 4. Open in browser

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

### 5. Email OTP (optional)

For email registration and login, set up [EmailJS](https://www.emailjs.com/):

1. Create an account and add an Email Service
2. Create a template with variables `{{to_email}}` and `{{otp}}`
3. Enable "Allow API requests" in Account → Security
4. Copy `backend/.env.example` to `backend/.env` and add your keys

### 6. Use on phone (same WiFi)

1. Find your computer's IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
2. On your phone, open `http://<your-ip>:5173` (e.g. `http://192.168.1.5:5173`)
3. Register/login works — API auto-uses same hostname on port 3001
4. **Install as app:** Add to Home Screen (browser menu → "Add to Home Screen")

### 7. Test with multiple users

Open multiple browser tabs (or incognito windows), enter different usernames, and chat in real time.

## Project Structure

```
├── backend/
│   ├── server.js          # Express + Socket.io server
│   ├── db/connect.js      # MongoDB connection
│   └── models/            # User, Room, Message, Otp
├── frontend/
│   └── src/
│       ├── screens/       # ChatListScreen, ChatConversationScreen, LoginScreen
│       ├── components/    # Avatar, MessageBubble, EmojiPicker, etc.
│       ├── context/       # ChatContext (state + Socket.io)
│       └── utils/         # Helpers
└── README.md
```

## API / Socket Events

- `user:join` — Join chat with username
- `message:send` — Send message
- `message:edit` / `message:delete` — Edit/delete message
- `message:react` — Add reaction
- `typing:start` / `typing:stop` — Typing indicator
- `dm:create` — Start direct message
- `room:create` — Create group chat
