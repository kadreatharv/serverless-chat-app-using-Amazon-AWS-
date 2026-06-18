const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:4001');

ws.on('open', () => {
  console.log('Connected!');
  ws.send(JSON.stringify({
    action: 'sendMessage',
    id: 1,
    senderId: 'test',
    text: 'Hello from test script',
    timestamp: '12:00 PM'
  }));
});

ws.on('message', (data) => {
  console.log('Received:', data.toString());
  process.exit(0);
});

ws.on('error', (err) => {
  console.error('WebSocket Error:', err);
  process.exit(1);
});

setTimeout(() => {
  console.log('Timeout waiting for message');
  process.exit(1);
}, 5000);
