// Define interface for environment to ensure type safety
interface Environment {
  production: boolean;
  debug: boolean;
  backendUrl: string;
  apiUrl: string;
  baseAppUrl: string;
  supabase: {
    url: string;
    key: string;
    db: {
      host: string;
      schema: string;
      port: number;
      connectionString: string;
    };
    buckets: {
      events: string;
      checkpoints: string;
      gpx: string;
    };
    realtime: {
      enabled: boolean;
      channels: string[];
    };
  };
  authorizedIps: string[];
  defaultAdminEmail: string;
  defaultAdminPassword: string;
}

export const environment: Environment = {
  production: false,
  debug: true,
  backendUrl: 'http://127.0.0.1:3000', // Replace with your actual IP
  apiUrl: 'http://127.0.0.1:3000/api', // API endpoint for the backend
  
  // URLs for the app
  baseAppUrl: 'http://192.168.1.224',
  
  // Enhanced Supabase configuration with direct database access parameters
  supabase: {
    url: 'https://ntvbwgkvbiwbjqffbxsv.supabase.co', // Replace with your Supabase URL
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50dmJ3Z2t2Yml3YmpxZmZieHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQwNDg5MTYsImV4cCI6MjA1OTYyNDkxNn0.hQFyrlK4AqlbBQxoz2jlbmRhvCFS-WRBh4w1PvU_swE', // Replace with your Supabase anon key
    
    // Database direct connection details (for development purpose)
    db: {
      host: 'db.ntvbwgkvbiwbjqffbxsv.supabase.co',
      schema: 'public',
      port: 5432,
      // Fix connection string to match the correct host
      connectionString: 'postgresql://postgres:3659w3659!W@db.ntvbwgkvbiwbjqffbxsv.supabase.co:5432/postgres'
    },
    
    // Storage bucket names
    buckets: {
      events: 'event-images',
      checkpoints: 'checkpoint-images',
      gpx: 'gpx-files'
    },
    
    // Realtime configuration
    realtime: {
      enabled: true,
      channels: ['profiles', 'events', 'participants']
    }
  },
  authorizedIps: ['127.0.0.1', 'localhost', '192.168.1.224', '192.168.1.211'], // Add your specific IP here
  defaultAdminEmail: 'admin@example.com',
  defaultAdminPassword: 'Admin123!' // This would normally be hashed
};

console.log('App Environment Loaded, Backend URL:', environment.backendUrl);

// Print connection info if debug enabled
if (environment.debug) {
  console.log('App Environment:', {
    backendUrl: environment.backendUrl,
    apiUrl: environment.apiUrl,
    hostname: window.location.hostname,
    origin: window.location.origin,
    href: window.location.href,
    protocol: window.location.protocol,
    port: window.location.port,
    supabaseUrl: environment.supabase.url
  });
}

//3vA+m5c}mtY;tNmy72(82T:w"KSwC~J!*8\?h8Rb*.y/M&y]9j