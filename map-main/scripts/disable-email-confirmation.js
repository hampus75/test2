#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Get Supabase credentials from environment
const supabaseUrl = process.env.SUPABASE_URL || 'https://cxevzikcudqrwxiexysk.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4ZXZ6aWtjdWRxcnd4aWV4eXNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4NDEwMzMsImV4cCI6MjA1OTQxNzAzM30.2GORWFr-XbpoepGp_14aSVUzXu4Drasxv3IrJz8lRX8';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function disableEmailConfirmation() {
  console.log('Disabling email confirmation requirement...');
  
  try {
    // SQL to update auth configuration
    const updateAuthConfigSQL = `
    -- Make sure we have access to change auth settings
    GRANT pg_read_all_settings TO postgres;
    
    -- Disable email confirmation
    UPDATE auth.config
    SET confirm_email_on_signup = false
    WHERE id = 1;
    `;
    
    const { error } = await supabase.rpc('exec_sql', {
      sql: updateAuthConfigSQL
    });
    
    if (error) {
      console.error('❌ Error disabling email confirmation:', error.message);
      console.log('\nThe RPC method failed. You need to manually update settings:');
      console.log('1. Go to your Supabase Dashboard');
      console.log('2. Navigate to Authentication > Settings');
      console.log('3. Scroll to "Email Auth" section');
      console.log('4. Turn OFF "Enable email confirmations"');
      console.log('5. Click "Save" button');
    } else {
      console.log('✅ Email confirmation requirement disabled successfully');
    }
    
    // Check if there are any unconfirmed users and confirm them
    console.log('\nChecking for unconfirmed users...');
    
    const confirmUsersSQL = `
    -- Confirm any existing unconfirmed users
    UPDATE auth.users
    SET email_confirmed_at = NOW()
    WHERE email_confirmed_at IS NULL;
    `;
    
    const { error: confirmError } = await supabase.rpc('exec_sql', {
      sql: confirmUsersSQL
    });
    
    if (confirmError) {
      console.error('❌ Error confirming existing users:', confirmError.message);
    } else {
      console.log('✅ Any existing unconfirmed users have been confirmed');
    }
    
  } catch (error) {
    console.error('Unexpected error:', error.message);
  }
  
  console.log('\nProcess completed. You can now create accounts without email confirmation.');
}

disableEmailConfirmation(); 