#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

// Get Supabase credentials from environment
const supabaseUrl = process.env.SUPABASE_URL || 'https://cxevzikcudqrwxiexysk.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4ZXZ6aWtjdWRxcnd4aWV4eXNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4NDEwMzMsImV4cCI6MjA1OTQxNzAzM30.2GORWFr-XbpoepGp_14aSVUzXu4Drasxv3IrJz8lRX8';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function displayUserMenu() {
  console.log('\nAccount Management:');
  console.log('1. List all users');
  console.log('2. Check if a specific email exists');
  console.log('3. Delete a user by email');
  console.log('4. Create admin account');
  console.log('5. Change user role');
  console.log('6. Exit');
  
  rl.question('\nChoose an option (1-6): ', async (answer) => {
    switch (answer) {
      case '1':
        await listAllUsers();
        break;
      case '2':
        await checkEmailExists();
        break;
      case '3':
        await deleteUser();
        break;
      case '4':
        await createAdminAccount();
        break;
      case '5':
        await changeUserRole();
        break;
      case '6':
        console.log('Exiting...');
        rl.close();
        return;
      default:
        console.log('Invalid option, please try again');
    }
    
    // Don't call displayUserMenu again here, it will be called after the function completes
    setTimeout(displayUserMenu, 500);
  });
}

async function listAllUsers() {
  console.log('\nFetching users from profiles table...');
  
  try {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*');
    
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError.message);
      return;
    }
    
    if (!profiles || profiles.length === 0) {
      console.log('No users found in profiles table');
      return;
    }
    
    console.log('\nUsers in database:');
    console.log('------------------');
    
    profiles.forEach(profile => {
      console.log(`ID: ${profile.user_id}`);
      console.log(`Name: ${profile.name}`);
      console.log(`Email: ${profile.email || 'Not set'}`);
      console.log(`Role: ${profile.role}`);
      console.log('------------------');
    });
    
    console.log(`Total users: ${profiles.length}`);
    
  } catch (error) {
    console.error('Unexpected error:', error.message);
  }
}

async function checkEmailExists() {
  rl.question('\nEnter email to check: ', async (email) => {
    try {
      // Check if the user exists in auth.users (we can't query directly, so we'll use a sign-in attempt)
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: 'fake-password-for-checking'
      });
      
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          console.log(`✅ User with email ${email} exists (but password is incorrect)`);
        } else if (error.message.includes('Email not confirmed')) {
          console.log(`✅ User with email ${email} exists (email not confirmed)`);
        } else if (error.message.includes('Invalid')) {
          console.log(`❌ User with email ${email} does not exist`);
        } else {
          console.log(`Error checking email: ${error.message}`);
        }
      } else {
        console.log(`✅ User with email ${email} exists (and login worked - this shouldn't happen with fake password)`);
      }
    } catch (error) {
      console.error('Error checking email:', error.message);
    }
  });
}

async function deleteUser() {
  rl.question('\nEnter email of user to delete: ', async (email) => {
    try {
      // Check if we can find the user by email from profiles
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email);
      
      if (profileError) {
        console.error('Error searching for user profile:', profileError.message);
        return;
      }
      
      if (!profiles || profiles.length === 0) {
        console.log(`No user found with email ${email}`);
        return;
      }
      
      rl.question(`Are you sure you want to delete user ${email}? This cannot be undone. [y/N]: `, async (confirm) => {
        if (confirm.toLowerCase() !== 'y') {
          console.log('Operation cancelled');
          return;
        }
        
        // Delete user - this requires an admin key or service role key
        const { error: deleteError } = await supabase.auth.admin.deleteUser(
          profiles[0].user_id
        );
        
        if (deleteError) {
          console.error('Error deleting user:', deleteError.message);
          console.log('Note: You need admin privileges to delete users.');
          console.log('If you are using the anon key, make sure to set SUPABASE_SERVICE_KEY in your .env file.');
        } else {
          console.log(`✅ User ${email} deleted successfully`);
        }
      });
    } catch (error) {
      console.error('Error deleting user:', error.message);
    }
  });
}

async function createAdminAccount() {
  rl.question('\nEnter admin email: ', (email) => {
    rl.question('Enter admin password: ', async (password) => {
      rl.question('Enter admin name: ', async (name) => {
        try {
          // Sign up the user with admin role
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                name: name || 'Admin',
                role: 'admin'
              }
            }
          });
          
          if (error) {
            console.error('Error creating admin account:', error.message);
            return;
          }
          
          if (!data.user) {
            console.error('No user data returned');
            return;
          }
          
          console.log(`✅ Admin account created successfully`);
          console.log(`Email: ${email}`);
          console.log('Check your email to confirm your account');
        } catch (error) {
          console.error('Error creating admin account:', error.message);
        }
      });
    });
  });
}

async function changeUserRole() {
  rl.question('\nEnter user email: ', async (email) => {
    try {
      // Find user profile
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email);
      
      if (profileError) {
        console.error('Error finding user profile:', profileError.message);
        return;
      }
      
      if (!profiles || profiles.length === 0) {
        console.log(`No user found with email ${email}`);
        return;
      }
      
      const profile = profiles[0];
      console.log(`Current role: ${profile.role}`);
      
      rl.question('Enter new role (admin, organizer, user): ', async (role) => {
        if (!['admin', 'organizer', 'user'].includes(role)) {
          console.log('Invalid role. Must be one of: admin, organizer, user');
          return;
        }
        
        // Update the role
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ role })
          .eq('user_id', profile.user_id);
        
        if (updateError) {
          console.error('Error updating user role:', updateError.message);
        } else {
          console.log(`✅ User ${email} role updated to ${role}`);
        }
      });
    } catch (error) {
      console.error('Error changing user role:', error.message);
    }
  });
}

console.log('Connecting to Supabase...');
displayUserMenu();