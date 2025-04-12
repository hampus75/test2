const http = require('http');
const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Configuration
const PORT = process.env.MCP_PORT || 9999;
const HOST = process.env.MCP_HOST || 'localhost';

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Cursor MCP Server Running');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Initialize Supabase client
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: Supabase URL and key are required. Please set SUPABASE_URL and SUPABASE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('Client connected');

  // Handle messages from clients
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received:', data);

      // Handle different message types
      switch (data.type) {
        case 'edit':
          // Handle edit requests (update in Supabase)
          if (data.file && data.content) {
            const { error } = await supabase
              .from('files')
              .upsert({ 
                path: data.file, 
                content: data.content, 
                updated_at: new Date().toISOString() 
              });
            
            if (error) {
              ws.send(JSON.stringify({ type: 'error', message: error.message }));
            } else {
              ws.send(JSON.stringify({ type: 'success', message: 'File updated' }));
            }
          }
          break;
        
        case 'get':
          // Handle get requests (retrieve from Supabase)
          if (data.file) {
            const { data: fileData, error } = await supabase
              .from('files')
              .select('*')
              .eq('path', data.file)
              .single();
            
            if (error) {
              ws.send(JSON.stringify({ type: 'error', message: error.message }));
            } else if (fileData) {
              ws.send(JSON.stringify({ 
                type: 'file', 
                file: data.file, 
                content: fileData.content 
              }));
            }
          }
          break;
          
        case 'ping':
          // Respond to ping with pong
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
          
        default:
          ws.send(JSON.stringify({ type: 'error', message: 'Unknown command' }));
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  // Handle disconnections
  ws.on('close', () => {
    console.log('Client disconnected');
  });

  // Send welcome message
  ws.send(JSON.stringify({ type: 'info', message: 'Connected to Cursor MCP Server' }));
});

// Start the server
server.listen(PORT, HOST, () => {
  console.log(`Cursor MCP Server running at http://${HOST}:${PORT}`);
  console.log(`WebSocket server listening on ws://${HOST}:${PORT}`);
}); 