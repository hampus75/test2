// Import the Environment interface if it's in a separate file
// or redeclare it here for simplicity
interface Environment {
  production: boolean;
  debug: boolean;
  backendUrl: string;
  apiUrl: string;
  baseAppUrl: string;
  supabase: {
    url: string;
    key: string;
    buckets: {
      events: string;
      checkpoints: string;
      gpx: string;
    }
  };
  authorizedIps: string[];
  defaultAdminEmail: string;
  defaultAdminPassword: string;
}

export const environment: Environment = {
  production: true,
  debug: false,
  backendUrl: 'https://api.ebrevet.org',
  apiUrl: 'https://api.ebrevet.org/api',
  baseAppUrl: 'https://ebrevet.org',
  supabase: {
    url: 'https://mvsjphhkrrinxdrevoqy.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12c2pwaGhrcnJpbnhkcmV2b3F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM5NTIzNzksImV4cCI6MjA1OTUyODM3OX0.obnnj5AE8oF3Qzibii3pmChgvgiGbG9L-lkUY-bsHMo',
    buckets: {
      events: 'event-images',
      checkpoints: 'checkpoint-images',
      gpx: 'gpx-files'
    }
  },
  authorizedIps: [], // No local IPs for production
  defaultAdminEmail: 'admin@ebrevet.org',
  defaultAdminPassword: 'Admin123!' // Should be managed through secure environment variables in production
};
