const WebSocket = require('ws');

class CursorMCPClient {
  constructor(host = 'localhost', port = 9999) {
    this.host = host;
    this.port = port;
    this.ws = null;
    this.isConnected = false;
    this.messageHandlers = {};
    this.reconnectInterval = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(`ws://${this.host}:${this.port}`);

        this.ws.on('open', () => {
          console.log('Connected to Cursor MCP Server');
          this.isConnected = true;
          this.startHeartbeat();
          resolve(true);
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data);
            console.log('Received message:', message);
            
            if (this.messageHandlers[message.type]) {
              this.messageHandlers[message.type](message);
            }
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        });

        this.ws.on('close', () => {
          console.log('Disconnected from Cursor MCP Server');
          this.isConnected = false;
          this.stopHeartbeat();
          this.reconnect();
        });

        this.ws.on('error', (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        });
      } catch (error) {
        console.error('Failed to connect:', error);
        reject(error);
      }
    });
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'ping' });
      }
    }, 30000); // Send ping every 30 seconds
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  reconnect() {
    if (!this.reconnectInterval) {
      this.reconnectInterval = setInterval(() => {
        console.log('Attempting to reconnect...');
        this.connect()
          .then(() => {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
          })
          .catch(() => {
            console.log('Reconnection failed, will try again');
          });
      }, 5000); // Try to reconnect every 5 seconds
    }
  }

  disconnect() {
    if (this.ws && this.isConnected) {
      this.ws.close();
      this.isConnected = false;
      this.stopHeartbeat();
      if (this.reconnectInterval) {
        clearInterval(this.reconnectInterval);
        this.reconnectInterval = null;
      }
    }
  }

  send(data) {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  // File operations
  getFile(filePath) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('Not connected to server'));
        return;
      }

      const messageHandler = (message) => {
        if (message.type === 'file' && message.file === filePath) {
          resolve(message.content);
          delete this.messageHandlers['file'];
        } else if (message.type === 'error') {
          reject(new Error(message.message));
          delete this.messageHandlers['file'];
        }
      };

      this.messageHandlers['file'] = messageHandler;
      this.messageHandlers['error'] = messageHandler;

      this.send({
        type: 'get',
        file: filePath
      });
    });
  }

  editFile(filePath, content) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('Not connected to server'));
        return;
      }

      const messageHandler = (message) => {
        if (message.type === 'success') {
          resolve(true);
          delete this.messageHandlers['success'];
        } else if (message.type === 'error') {
          reject(new Error(message.message));
          delete this.messageHandlers['error'];
        }
      };

      this.messageHandlers['success'] = messageHandler;
      this.messageHandlers['error'] = messageHandler;

      this.send({
        type: 'edit',
        file: filePath,
        content: content
      });
    });
  }

  // Add event listeners
  on(eventType, callback) {
    this.messageHandlers[eventType] = callback;
  }

  // Remove event listeners
  off(eventType) {
    delete this.messageHandlers[eventType];
  }
}

module.exports = CursorMCPClient;

// Example usage:
// const client = new CursorMCPClient();
// client.connect()
//   .then(() => {
//     // Get a file
//     return client.getFile('path/to/file.js');
//   })
//   .then((content) => {
//     console.log('File content:', content);
//     
//     // Edit a file
//     return client.editFile('path/to/file.js', 'new content');
//   })
//   .then(() => {
//     console.log('File edited successfully');
//     client.disconnect();
//   })
//   .catch((error) => {
//     console.error('Error:', error);
//   }); 