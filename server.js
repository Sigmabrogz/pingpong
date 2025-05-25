import { WebSocketServer } from 'ws';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create Express app for serving static files
const app = express();
app.use(express.static(__dirname));

// Start HTTP server on port 3001
const server = app.listen(3001, () => {
  console.log('HTTP Server running on port 3001');
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Store connected clients
const clients = new Map();
let gameState = {
  balls: [],
  dayScore: 0,
  nightScore: 0,
  isGameRunning: false
};

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // Generate unique ID for this client
  const clientId = Date.now().toString();
  clients.set(ws, { id: clientId });
  
  // Send current game state to new client
  ws.send(JSON.stringify({
    type: 'gameState',
    data: gameState
  }));
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Update game state if this is a state update
      if (data.type === 'gameState') {
        gameState = data.data;
        
        // Broadcast to all other clients
        clients.forEach((client, clientWs) => {
          if (clientWs !== ws && clientWs.readyState === WebSocketServer.OPEN) {
            clientWs.send(JSON.stringify({
              type: 'gameState',
              data: gameState
            }));
          }
        });
      }
      
      // Handle game start
      if (data.type === 'gameStart') {
        gameState.isGameRunning = true;
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocketServer.OPEN) {
            client.send(JSON.stringify({
              type: 'gameStart'
            }));
          }
        });
      }
      
      // Handle game end
      if (data.type === 'gameEnd') {
        gameState.isGameRunning = false;
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocketServer.OPEN) {
            client.send(JSON.stringify({
              type: 'gameEnd',
              data: data.data
            }));
          }
        });
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
  
  ws.on('close', () => {
    clients.delete(ws);
    console.log('Client disconnected');
  });
});

console.log('WebSocket server is running on ws://localhost:3001');