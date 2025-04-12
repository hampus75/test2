#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

// Get Supabase credentials from environment
const supabaseUrl = process.env.SUPABASE_URL || 'https://cxevzikcudqrwxiexysk.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4ZXZ6aWtjdWRxcnd4aWV4eXNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4NDEwMzMsImV4cCI6MjA1OTQxNzAzM30.2GORWFr-XbpoepGp_14aSVUzXu4Drasxv3IrJz8lRX8';

// Admin credentials - can be overridden from .env file
const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function createAdminAccount() {
  console.log('=== Admin Account Creation ===');
  
  // Ask for confirmation or custom credentials
  rl.question(`Use default admin credentials (${adminEmail})? [Y/n]: `, async (answer) => {
    let email = adminEmail;
    let password = adminPassword;
    
    if (answer.toLowerCase() === 'n') {
      await new Promise((resolve) => {
        rl.question('Enter admin email: ', (inputEmail) => {
          email = inputEmail;
          rl.question('Enter admin password: ', (inputPassword) => {
            password = inputPassword;
            resolve();
          });
        });
      });
    }
    
    console.log(`\nCreating admin account with email: ${email}`);
    
    try {
      // First check if user already exists
      const { data: authUser, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (!authError && authUser) {
        console.log('✅ Admin account already exists and credentials are valid');
        
        // Check if the user has admin role
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', authUser.user.id)
          .single();
        
        if (!profileError && profile && profile.role === 'admin') {
          console.log('✅ User already has admin role');
        } else {
          console.log('User exists but does not have admin role. Updating role...');
          
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ role: 'admin' })
            .eq('user_id', authUser.user.id);
          
          if (updateError) {
            console.error('❌ Error updating role:', updateError.message);
          } else {
            console.log('✅ User role updated to admin');
          }
        }
        
        rl.close();
        return;
      }
      
      // Sign up the user with metadata
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: 'Admin',
            role: 'admin'
          }
        }
      });
      
      if (error) {
        console.error('❌ Error creating admin account:', error.message);
        
        // If user exists but password is wrong, prompt for reset
        if (error.message.includes('already registered')) {
          rl.question('User exists. Reset password? [y/N]: ', async (resetAnswer) => {
            if (resetAnswer.toLowerCase() === 'y') {
              const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
              
              if (resetError) {
                console.error('❌ Error sending reset email:', resetError.message);
              } else {
                console.log('✅ Password reset email sent to', email);
              }
            }
            rl.close();
          });
          return;
        }
        
        rl.close();
        return;
      }
      
      console.log('✅ Admin user created successfully');
      console.log(`Email: ${email}`);
      console.log(`Password: ${password}`);
      
      if (data.session === null) {
        console.log('\nNOTE: Email confirmation may be required before logging in');
        console.log('Check your email inbox and confirm your account');
      }
      
      rl.close();
      
    } catch (error) {
      console.error('❌ Unexpected error:', error.message);
      rl.close();
    }
  });
}

createAdminAccount();