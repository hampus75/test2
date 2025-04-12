import { createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

/**
 * DB Checker - A utility to check database connections
 * 
 * HOW TO USE:
 * 1. Import in console or add to a component:
 *    import { DBChecker } from '../utils/db-checker';
 * 
 * 2. Run checks:
 *    DBChecker.checkConnection();
 *    DBChecker.checkAuth();
 *    DBChecker.runFullDiagnostics();
 */
export class DBChecker {
  private static supabase = createClient(
    environment.supabase.url,
    environment.supabase.key
  );
  
  /**
   * Run a basic connection check
   */
  static async checkConnection() {
    console.log('🔍 Testing database connection...');
    try {
      const startTime = performance.now();
      const { data, error } = await this.supabase
        .from('profiles')
        .select('count')
        .limit(1);
      
      const duration = Math.round(performance.now() - startTime);
      
      if (error) {
        console.error('❌ Connection failed:', error.message);
        console.error('Details:', error);
        return false;
      }
      
      console.log(`✅ Connection successful! (${duration}ms)`);
      console.log('Data received:', data);
      return true;
    } catch (error) {
      console.error('❌ Connection exception:', error);
      return false;
    }
  }
  
  /**
   * Check authentication system
   */
  static async checkAuth() {
    console.log('🔑 Testing authentication system...');
    try {
      const startTime = performance.now();
      const { data, error } = await this.supabase.auth.getSession();
      
      const duration = Math.round(performance.now() - startTime);
      
      if (error) {
        console.error('❌ Auth system check failed:', error.message);
        console.error('Details:', error);
        return false;
      }
      
      if (data.session) {
        console.log(`✅ Auth system working! Session found (${duration}ms)`);
      } else {
        console.log(`✅ Auth system working! No active session (${duration}ms)`);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Auth system exception:', error);
      return false;
    }
  }
  
  /**
   * Check server URL configuration
   */
  static checkURLs() {
    console.log('🌐 Checking configured URLs...');
    console.log('Supabase URL:', environment.supabase.url);
    
    try {
      const url = new URL(environment.supabase.url);
      console.log('✅ URL is valid');
      return true;
    } catch (e) {
      console.error('❌ Supabase URL is invalid');
      return false;
    }
  }
  
  /**
   * Check API key format
   */
  static checkAPIKey() {
    console.log('🔑 Checking API key format...');
    const key = environment.supabase.key;
    
    if (!key) {
      console.error('❌ API key is missing');
      return false;
    }
    
    if (key.length < 20) {
      console.error('❌ API key seems too short:', key.substring(0, 5) + '...');
      return false;
    }
    
    console.log('✅ API key format seems valid:', key.substring(0, 5) + '...');
    return true;
  }
  
  /**
   * Test writing to the database
   */
  static async testWrite() {
    console.log('✏️ Testing database write...');
    
    try {
      const testData = {
        test_id: `test-${Date.now()}`,
        timestamp: new Date().toISOString(),
        test_value: 'Connection test'
      };
      
      const { data, error } = await this.supabase
        .from('_diagnostics')
        .insert(testData)
        .select();
      
      if (error) {
        // This might fail if the table doesn't exist, which is normal
        console.warn('⚠️ Test write failed, but this may be expected if the _diagnostics table doesn\'t exist');
        console.warn('Error:', error.message);
      } else {
        console.log('✅ Test write successful');
        console.log('Written data:', data);
      }
      
      return !error;
    } catch (error) {
      console.error('❌ Test write exception:', error);
      return false;
    }
  }
  
  /**
   * Run all diagnostics
   */
  static async runFullDiagnostics() {
    console.group('🔍 SUPABASE CONNECTION DIAGNOSTICS');
    console.log('Starting full diagnostics at', new Date().toLocaleTimeString());
    
    console.group('1. URL & API Key Check');
    const urlCheck = this.checkURLs();
    const keyCheck = this.checkAPIKey();
    console.groupEnd();
    
    console.group('2. Connection Check');
    const connectionCheck = await this.checkConnection();
    console.groupEnd();
    
    console.group('3. Auth System Check');
    const authCheck = await this.checkAuth();
    console.groupEnd();
    
    console.group('4. Write Test');
    const writeCheck = await this.testWrite();
    console.groupEnd();
    
    console.log('📊 Diagnostics Summary:');
    console.log('- URL Configuration:', urlCheck ? '✅ OK' : '❌ Issue');
    console.log('- API Key Format:', keyCheck ? '✅ OK' : '❌ Issue');
    console.log('- Database Connection:', connectionCheck ? '✅ OK' : '❌ Issue');
    console.log('- Auth System:', authCheck ? '✅ OK' : '❌ Issue');
    console.log('- Database Write:', writeCheck ? '✅ OK' : '⚠️ Check logs');
    
    const overallStatus = urlCheck && keyCheck && connectionCheck && authCheck;
    console.log(`\nOverall diagnosis: ${overallStatus ? '✅ SYSTEM OPERATIONAL' : '❌ ISSUES DETECTED'}`);
    
    console.groupEnd();
    return overallStatus;
  }

  /**
   * Get environment information
   */
  static getEnvironmentInfo() {
    console.group('🌍 Environment Information');
    console.log('Angular Environment:', environment.production ? 'Production' : 'Development');
    console.log('API URL:', environment.supabase.url);
    console.log('Other config keys available:', Object.keys(environment).filter(k => k !== 'supabase'));
    console.groupEnd();
  }
}

// Add this to make it easily accessibly in browser console
(window as any).DBChecker = DBChecker;
console.log('DBChecker utility loaded. Type DBChecker.runFullDiagnostics() to run tests.');
