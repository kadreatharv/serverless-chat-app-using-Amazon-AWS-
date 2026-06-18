import React, { useState, useEffect, useRef } from 'react';
import './index.css';

function App() {
  const [isJoined, setIsJoined]     = useState(false);
  const [username, setUsername]     = useState('');
  const [room, setRoom]             = useState('General');
  const [messages, setMessages]     = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [typingUsers, setTypingUsers]   = useState(new Set());
  const [onlineUsers, setOnlineUsers]   = useState([]);
  const [notification, setNotification] = useState(null);

  const messagesEndRef       = useRef(null);
  const wsRef                = useRef(null);
  const typingTimeoutRef     = useRef(null);
  const userTypingTimeouts   = useRef({});
  const notificationTimeout  = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // ── Helper: show a brief notification banner ──────────────────────────────
  const showNotification = (msg, type = 'info') => {
    setNotification({ msg, type });
    clearTimeout(notificationTimeout.current);
    notificationTimeout.current = setTimeout(() => setNotification(null), 3500);
  };

  // ── Join handler ──────────────────────────────────────────────────────────
  const handleJoin = (e) => {
    e.preventDefault();
    if (username.trim() && room.trim()) {
      setIsJoined(true);
      connectWebSocket(username.trim(), room);
    }
  };

  // ── WebSocket setup ───────────────────────────────────────────────────────
  const connectWebSocket = (user, selectedRoom) => {
    const url = `ws://localhost:4001?username=${encodeURIComponent(user)}&room=${encodeURIComponent(selectedRoom)}`;
    const ws  = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to WebSocket API');
      ws.send(JSON.stringify({ action: 'getRecentMessages', roomName: selectedRoom }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.action) {
          case 'history':
            setMessages(data.messages || []);
            break;

          case 'receiveMessage':
            setMessages(prev => [...prev, data]);
            // Clear that user's typing indicator on receive
            setTypingUsers(prev => {
              const s = new Set(prev);
              s.delete(data.username);
              return s;
            });
            break;

          case 'userJoined':
            setOnlineUsers(data.userList || []);
            if (data.username !== user) {
              showNotification(`🟢 ${data.username} joined ${selectedRoom}`, 'join');
            }
            break;

          case 'userLeft':
            setOnlineUsers(data.userList || []);
            showNotification(`🔴 ${data.username} left ${selectedRoom}`, 'leave');
            break;

          case 'typing':
            handleUserTyping(data.username);
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('Error parsing message:', err);
      }
    };

    ws.onclose = () => {
      console.log('Disconnected');
    };
  };

  // ── Typing indicator logic ────────────────────────────────────────────────
  const handleUserTyping = (typingUser) => {
    setTypingUsers(prev => new Set(prev).add(typingUser));
    clearTimeout(userTypingTimeouts.current[typingUser]);
    userTypingTimeouts.current[typingUser] = setTimeout(() => {
      setTypingUsers(prev => {
        const s = new Set(prev);
        s.delete(typingUser);
        return s;
      });
    }, 3000);
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      if (!typingTimeoutRef.current) {
        wsRef.current.send(JSON.stringify({ action: 'typing', username, roomName: room }));
      } else {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => { typingTimeoutRef.current = null; }, 2000);
    }
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    const messageData = {
      action:    'sendMessage',
      id:        Date.now().toString(),
      senderId:  username,
      username,
      roomName:  room,
      text:      inputValue,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    wsRef.current?.send(JSON.stringify(messageData));
    setInputValue('');
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getInitials = (name) => name ? name.substring(0, 2).toUpperCase() : '??';

  const avatarColor = (name) => {
    const colors = [
      'linear-gradient(135deg,#6366f1,#8b5cf6)',
      'linear-gradient(135deg,#ec4899,#f43f5e)',
      'linear-gradient(135deg,#14b8a6,#06b6d4)',
      'linear-gradient(135deg,#f59e0b,#ef4444)',
      'linear-gradient(135deg,#10b981,#3b82f6)',
    ];
    if (!name) return colors[0];
    return colors[name.charCodeAt(0) % colors.length];
  };

  // ─────────────────────────────────────────────────────────────────────────
  // JOIN SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  if (!isJoined) {
    return (
      <div className="join-container">
        <div className="join-card">
          <div className="join-logo">
            <span className="logo-icon">⚡</span>
            <h1>Nexus Chat</h1>
          </div>
          <p className="join-subtitle">Serverless • Real-time • Scalable</p>

          <form onSubmit={handleJoin}>
            <div className="input-group">
              <label>Your Name</label>
              <input
                type="text"
                placeholder="e.g. Atharv"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                maxLength={20}
              />
            </div>
            <div className="input-group">
              <label>Select Room</label>
              <select value={room} onChange={(e) => setRoom(e.target.value)}>
                <option value="General">💬 General</option>
                <option value="Engineering">⚙️ Engineering</option>
                <option value="Random">🎲 Random</option>
                <option value="Support">🛠️ Support</option>
              </select>
            </div>
            <button type="submit" className="join-button">
              Join Room →
            </button>
          </form>

          <p className="join-footer">
            Powered by AWS Lambda · DynamoDB · API Gateway
          </p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CHAT SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="app-layout">
      {/* ── Notification Banner ───────────────────────────────────────────── */}
      {notification && (
        <div className={`notification-banner ${notification.type}`}>
          {notification.msg}
        </div>
      )}

      {/* ── Main Chat Panel ───────────────────────────────────────────────── */}
      <div className="chat-container">
        <header className="chat-header">
          <div className="header-left">
            <span className="logo-icon-sm">⚡</span>
            <div>
              <h1>Nexus Chat</h1>
              <span className="room-badge">#{room}</span>
            </div>
          </div>
          <div className="header-right">
            <div className="status-dot"></div>
            <div className="my-avatar" style={{ background: avatarColor(username) }}>
              {getInitials(username)}
            </div>
            <span className="my-name">{username}</span>
          </div>
        </header>

        <main className="chat-messages" id="chat-messages">
          {messages.length === 0 && (
            <div className="empty-state">
              <span>💬</span>
              <p>No messages in <strong>#{room}</strong> yet.</p>
              <p className="empty-hint">Try <code>@bot Explain AWS Lambda</code> to chat with AI!</p>
            </div>
          )}

          {messages.map((msg, idx) => {
            const isOwn  = msg.username === username;
            const isBot  = msg.senderId === 'bot';
            const prevMsg = messages[idx - 1];
            const showMeta = idx === 0 || prevMsg?.username !== msg.username;

            return (
              <div
                key={msg.messageId || idx}
                className={`message-wrapper ${isOwn ? 'own' : 'other'}`}
              >
                {!isOwn && (
                  showMeta
                    ? <div className="avatar" style={{ background: isBot ? 'linear-gradient(135deg,#14b8a6,#0ea5e9)' : avatarColor(msg.username) }}>
                        {isBot ? '🤖' : getInitials(msg.username)}
                      </div>
                    : <div className="avatar-spacer" />
                )}

                <div className={`message ${isOwn ? 'own' : 'other'} ${isBot ? 'bot-msg' : ''}`}>
                  {!isOwn && showMeta && (
                    <div className="message-sender">{msg.username}</div>
                  )}
                  <div className="message-content">{msg.text}</div>
                  <div className="message-timestamp">{msg.timeString}</div>
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {typingUsers.size > 0 && (
            <div className="message-wrapper other">
              <div className="avatar" style={{ background: 'var(--bg-input)', fontSize: '1rem' }}>💬</div>
              <div className="typing-bubble">
                <span /><span /><span />
              </div>
              <span className="typing-text">
                {[...typingUsers].join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing…
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </main>

        <form className="chat-input-container" onSubmit={sendMessage}>
          <input
            type="text"
            className="chat-input"
            placeholder={`Message #${room} … (try @bot hello)`}
            value={inputValue}
            onChange={handleInputChange}
          />
          <button type="submit" className="send-button" disabled={!inputValue.trim()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>

      {/* ── Online Users Sidebar ──────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-title">Online</span>
          <span className="online-count">{onlineUsers.length}</span>
        </div>
        <ul className="user-list">
          {onlineUsers.map((u, i) => (
            <li key={i} className={`user-item ${u === username ? 'me' : ''}`}>
              <div className="user-avatar-sm" style={{ background: avatarColor(u) }}>
                {getInitials(u)}
              </div>
              <span>{u}</span>
              {u === username && <span className="you-tag">you</span>}
            </li>
          ))}
        </ul>

        <div className="sidebar-footer">
          <div className="tech-badge">⚡ AWS Lambda</div>
          <div className="tech-badge">🗃️ DynamoDB</div>
          <div className="tech-badge">🌐 API Gateway</div>
        </div>
      </aside>
    </div>
  );
}

export default App;
