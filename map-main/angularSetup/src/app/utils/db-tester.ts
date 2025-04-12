/**
 * Database Tester Utility
 * 
 * A utility you can use to check database connectivity from the browser console
 * 
 * Usage:
 * 1. Call DBTester.testConnection() in browser console
 * 2. Check results in console
 */

import { createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

export class DBTester {
  // Create a fresh client for testing (not reusing auth service's client)
  private static supabase = createClient(
    environment.supabase.url,
    environment.supabase.key,
    {
      db: { schema: 'public' },
      auth: { persistSession: false }
    }
  );

  /**
   * Test database connection and print results to console
   */
  static async testConnection(): Promise<void> {
    console.log('%c === SUPABASE CONNECTION TEST === ', 'background: #3ECF8E; color: white; font-weight: bold; padding: 4px;');
    console.log('🔍 Testing connection to:', environment.supabase.url);
    
    try {
      // 1. Test auth system
      console.group('1. Auth System Check');
      const authStart = performance.now();
      const { data: authData, error: authError } = await this.supabase.auth.getSession();
      const authTime = Math.round(performance.now() - authStart);
      
      if (authError) {
        console.error('❌ Auth system error:', authError.message);
      } else {
        console.log(`✅ Auth system working (${authTime}ms)`);
        console.log('Has existing session:', !!authData.session);
      }
      console.groupEnd();
      
      // 2. Test database query
      console.group('2. Database Query Check');
      const dbStart = performance.now();
      const { data, error } = await this.supabase.from('profiles').select('count(*)', { count: 'exact', head: true });
      const dbTime = Math.round(performance.now() - dbStart);
      
      if (error) {
        console.error('❌ Database query error:', error.message);
        console.log('Trying alternative query...');
        
        // Try another query
        const { error: error2 } = await this.supabase.from('_prisma_migrations').select('count').limit(1);
        if (error2) {
          console.error('❌ Alternative query also failed:', error2.message);
        } else {
          console.log('✅ Alternative database query succeeded');
        }
      } else {
        console.log(`✅ Database query successful (${dbTime}ms)`);
      }
      console.groupEnd();
      
      // 3. Test storage
      console.group('3. Storage Bucket Check');
      try {
        const storageStart = performance.now();
        const { data: buckets, error: bucketError } = await this.supabase.storage.listBuckets();
        const storageTime = Math.round(performance.now() - storageStart);
        
        if (bucketError) {
          console.error('❌ Storage bucket error:', bucketError.message);
        } else {
          console.log(`✅ Storage system working (${storageTime}ms)`);
          console.log('Available buckets:', buckets.map(b => b.name));
        }
      } catch (e) {
        console.error('❌ Storage test exception:', e);
      }
      console.groupEnd();
      
      // 4. Summary
      console.group('4. Connection Summary');
      console.log('Project URL:', environment.supabase.url);
      console.log('Project ID:', environment.supabase.url.split('.')[0].split('//')[1]);
      console.log('API Key Format:', environment.supabase.key ? 
        (environment.supabase.key.startsWith('eyJ') ? '✅ Valid JWT format' : '⚠️ Unusual format') : 
        '❌ Missing');
      console.groupEnd();
      
    } catch (e) {
      console.error('❌ Connection test failed with exception:', e);
    }
    
    console.log('%c === TEST COMPLETE === ', 'background: #3ECF8E; color: white; font-weight: bold; padding: 4px;');
  }
}

// Expose to window for console access
(window as any).DBTester = DBTester;
console.log('Database tester utility loaded. Type DBTester.testConnection() in console to test connection.');
