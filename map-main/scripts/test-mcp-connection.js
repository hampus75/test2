const CursorMCPClient = require('./cursor-mcp-client');

// Create a client instance
const client = new CursorMCPClient();

console.log('Testing MCP server connection...');

// Connect to the server
client.connect()
  .then(() => {
    console.log('Successfully connected to MCP server!');
    
    // Test the ping functionality
    client.on('pong', () => {
      console.log('Received pong response!');
      
      // Test completed, disconnect
      setTimeout(() => {
        console.log('Test completed successfully. Disconnecting...');
        client.disconnect();
        process.exit(0);
      }, 1000);
    });
    
    // Send a ping message
    console.log('Sending ping message...');
    client.send({ type: 'ping' });
  })
  .catch((error) => {
    console.error('Failed to connect to MCP server:', error);
    process.exit(1);
  });

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('Disconnecting...');
  client.disconnect();
  process.exit(0);
}); 