const { networkInterfaces } = require('os');
const fs = require('fs');
const path = require('path');

// Get IP addresses
const nets = networkInterfaces();
const results = {};

// Find all network interfaces
for (const name of Object.keys(nets)) {
  for (const net of nets[name]) {
    // Skip internal and non-IPv4 interfaces
    if (net.family === 'IPv4' && !net.internal) {
      if (!results[name]) {
        results[name] = [];
      }
      results[name].push(net.address);
    }
  }
}

console.log('Network interfaces found:');
console.log(JSON.stringify(results, null, 2));
console.log('\nAccess URLs:');

// Find most likely external IP
let mainIP = '127.0.0.1';
// Prioritize common network interfaces for both macOS and Linux
const commonInterfaces = Object.keys(results);
commonInterfaces.forEach(iface => {
  // Linux typically uses wlan or eth interfaces
  // macOS typically uses en0 (Ethernet) or en1 (Wi-Fi)
  if (iface.startsWith('wlan') || 
      iface.startsWith('eth') || 
      iface.startsWith('en') || 
      iface.includes('Ethernet') ||
      iface.includes('Wi-Fi')) {
    mainIP = results[iface][0];
  }
});

console.log(`Frontend: http://${mainIP}:4200`);
console.log(`Backend API: http://${mainIP}:3000`);
console.log(`\nTo connect from another device on your network, use these URLs.`);

// Update environment config with correct IP
try {
  const envFilePath = path.join(__dirname, '../angularSetup/src/environments/environment.ts');
  
  if (fs.existsSync(envFilePath)) {
    let envContent = fs.readFileSync(envFilePath, 'utf8');
    
    // Replace localhost or placeholder IP with actual IP
    envContent = envContent.replace(/http:\/\/(localhost|127\.0\.0\.1|YOUR_IP_ADDRESS)/g, `http://${mainIP}`);
    
    fs.writeFileSync(envFilePath, envContent);
    console.log(`\nUpdated environment.ts with IP: ${mainIP}`);
  }
  
  // Update backend .env file
  const backendEnvPath = path.join(__dirname, '../backend/.env');
  if (fs.existsSync(backendEnvPath)) {
    let envContent = fs.readFileSync(backendEnvPath, 'utf8');
    
    // Update FRONTEND_URL to include the IP address
    if (envContent.includes('FRONTEND_URL=*')) {
      // Keep the wildcard for development
      console.log('\nBackend already accepting all origins (*). No changes needed.');
    } else {
      const frontendUrlLine = envContent.match(/FRONTEND_URL=.*/);
      if (frontendUrlLine) {
        const newLine = frontendUrlLine[0].includes(mainIP) ? 
          frontendUrlLine[0] : 
          `FRONTEND_URL=http://localhost:4200,http://${mainIP}:4200`;
          
        envContent = envContent.replace(/FRONTEND_URL=.*/, newLine);
        fs.writeFileSync(backendEnvPath, envContent);
        console.log(`\nUpdated backend .env with frontend URL: ${mainIP}`);
      }
    }
  }
} catch (error) {
  console.error('Error updating environment files:', error);
}

console.log('\nREMINDER: Make sure to update your Strava and RideWithGPS OAuth callback domains with this IP address!');
