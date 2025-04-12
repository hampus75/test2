/**
 * Mock implementation of pg for browser environments
 * This allows the PostgreSQL code to compile in the browser
 * but actually uses the backend API via HTTP
 */

import { environment } from '../../environments/environment';

export class Pool {
  constructor(options: any) {
    console.log('Creating mock PG pool with options:', options);
  }

  async connect() {
    console.log('Would connect to PostgreSQL database');
    return new MockClient();
  }
}

class MockClient {
  async query(text: string, params?: any[]) {
    console.log('Mock PG query:', text, params);
    
    // In a real implementation, this would call your backend API
    try {
      const endpoint = this.getEndpointForQuery(text);
      const response = await fetch(`${environment.apiUrl}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: text,
          params: params
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error executing mock query:', error);
      // Return empty result set
      return { rows: [] };
    }
  }
  
  private getEndpointForQuery(query: string): string {
    // Simple routing based on SQL command
    if (query.trim().toUpperCase().startsWith('SELECT')) {
      return 'query/select';
    } else if (query.trim().toUpperCase().startsWith('INSERT')) {
      return 'query/insert';
    } else if (query.trim().toUpperCase().startsWith('UPDATE')) {
      return 'query/update';
    } else if (query.trim().toUpperCase().startsWith('DELETE')) {
      return 'query/delete';
    } else {
      return 'query/execute';
    }
  }

  release() {
    console.log('Mock PG client released');
  }
} 