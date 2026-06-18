import React, { useState, useEffect, useRef } from 'react';
import './index.css';

function App() {
  const [isJoined, setIsJoined] = useState(false);
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('General');
  
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [typingUsers, setTypingUsers] = useState(new Set());
  
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const userTypingTimeouts = useRef({});

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  const handleJoin = (e) => {
    e.preventDefault();
    if (username.trim() && room.trim()) {
      setIsJoined(true);
      connectWebSocket(username, room);
    }
  };

  const connectWebSocket = (user, selectedRoom) => {
    // Connect with query parameters
    const url = `ws://localhost:4001?username=${encodeURIComponent(user)}&room=${encodeURIComponent(selectedRoom)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to WebSocket API');
      // Fetch recent history
      ws.send(JSON.stringify({ action: 'getRecentMessages', roomName: selectedRoom }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.action === 'history') {
          setMessages(data.messages || []);
        } else if (data.action === 'receiveMessage') {
          setMessages((prev) => [...prev, data]);
          
          // If they sent a message, they stopped typing
          setTypingUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(data.username);
            return newSet;
          });
        } else if (data.action === 'typing') {
          handleUserTyping(data.username);
        }
      } catch (err) {
        console.error('Error parsing message:', err);
      }
    };

    ws.onclose = () => {
      console.log('Disconnected');
      setIsJoined(false);
    };
  };

  const handleUserTyping = (typingUser) => {
    setTypingUsers(prev => new Set(prev).add(typingUser));
    
    if (userTypingTimeouts.current[typingUser]) {
      clearTimeout(userTypingTimeouts.current[typingUser]);
    }
    
    userTypingTimeouts.current[typingUser] = setTimeout(() => {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(typingUser);
        return newSet;
      });
    }, 3000);
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      if (!typingTimeoutRef.current) {
        wsRef.current.send(JSON.stringify({ action: 'typing', username, roomName: room }));
      } else {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        typingTimeoutRef.current = null;
      }, 2000);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (inputValue.trim() !== '') {
      const messageData = {
        action: 'sendMessage',
        id: Date.now().toString(),
        senderId: username,
        username: username,
        roomName: room,
        text: inputValue,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(messageData));
      }
      setInputValue('');
    }
  };

  const getInitials = (name) => {
    return name ? name.substring(0, 2).toUpperCase() : '??';
  };

  if (!isJoined) {
    return (
      <div className="join-container">
        <div className="join-card">
          <h1>Nexus Chat</h1>
          <p>Join a room to start chatting</p>
          <form onSubmit={handleJoin}>
            <div className="input-group">
              <label>Username</label>
              <input 
                type="text" 
                placeholder="Enter your name" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                required 
              />
            </div>
            <div className="input-group">
              <label>Room</label>
              <select value={room} onChange={(e) => setRoom(e.target.value)}>
                <option value="General">General</option>
                <option value="Engineering">Engineering</option>
                <option value="Random">Random</option>
                <option value="Support">Support</option>
              </select>
            </div>
            <button type="submit" className="join-button">Join Chat</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <header className="chat-header">
        <div className="header-info">
          <h1>
            <div className="status-dot"></div>
            Nexus Chat
          </h1>
          <span className="room-badge">{room}</span>
        </div>
        <div className="user-info">
          <span>{username}</span>
          <div className="avatar small">{getInitials(username)}</div>
        </div>
      </header>

      <main className="chat-messages">
        {messages.length === 0 && <div className="empty-state">No messages in {room} yet. Be the first to say hi!</div>}
        
        {messages.map((msg, idx) => {
          const isOwn = msg.username === username;
          const isBot = msg.senderId === 'bot';
          const showAvatar = idx === 0 || messages[idx - 1].username !== msg.username;
          
          return (
            <div key={msg.messageId || idx} className={`message-wrapper ${isOwn ? 'own' : 'other'}`}>
              {!isOwn && showAvatar && (
                <div className={`avatar ${isBot ? 'bot-avatar' : ''}`}>{isBot ? '🤖' : getInitials(msg.username)}</div>
              )}
              {!isOwn && !showAvatar && <div className="avatar-spacer"></div>}
              
              <div className={`message ${isOwn ? 'own' : 'other'} ${isBot ? 'bot-msg' : ''}`}>
                {!isOwn && showAvatar && <div className="message-sender">{msg.username}</div>}
                <div className="message-content">{msg.text}</div>
                <div className="message-timestamp">{msg.timeString || msg.timestamp}</div>
              </div>
            </div>
          );
        })}
        
        {typingUsers.size > 0 && (
          <div className="typing-indicator">
            <div className="avatar typing-avatar">💬</div>
            <div className="typing-bubble">
              <span></span><span></span><span></span>
            </div>
            <div className="typing-text">
              {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <form className="chat-input-container" onSubmit={sendMessage}>
        <input
          type="text"
          className="chat-input"
          placeholder="Type your message... (Try @bot hello)"
          value={inputValue}
          onChange={handleInputChange}
        />
        <button type="submit" className="send-button" disabled={!inputValue.trim()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
    </div>
  );
}

export default App;
