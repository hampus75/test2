#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
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

async function initializeDatabase() {
  console.log('=== Database Setup Wizard ===');
  console.log('This script will set up all the necessary tables and functions for the application');
  
  rl.question('Do you want to continue? [Y/n]: ', async (answer) => {
    if (answer.toLowerCase() === 'n') {
      console.log('Operation cancelled');
      rl.close();
      return;
    }
    
    try {
      console.log('\nConnecting to Supabase...');
      console.log(`URL: ${supabaseUrl}`);
      
      // Check connection
      const { data, error } = await supabase.from('_dummy_query_').select('*').limit(1);
      
      if (error && !error.message.includes('does not exist')) {
        console.error('Error connecting to Supabase:', error.message);
        rl.close();
        return;
      }
      
      console.log('✅ Connected to Supabase successfully');
      
      // Read the SQL schema file
      const schemaPath = path.join(__dirname, '../backend/supabase-schema.sql');
      
      if (!fs.existsSync(schemaPath)) {
        console.error('❌ Schema file not found:', schemaPath);
        createSchemaFilePrompt();
        return;
      }
      
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      console.log('\nExecuting schema creation scripts...');
      console.log('This may take a few moments...');
      
      // Split the SQL into individual statements
      const statements = schema
        .replace(/\/\*[\s\S]*?\*\/|--.*$/gm, '') // Remove comments
        .split(';')
        .filter(statement => statement.trim().length > 0);
      
      let successCount = 0;
      let failureCount = 0;
      
      for (const statement of statements) {
        const trimmedStatement = statement.trim();
        if (!trimmedStatement) continue;
        
        try {
          const { error } = await supabase.rpc('exec_sql', {
            sql: trimmedStatement + ';'
          });
          
          if (error) {
            console.error(`❌ Error executing SQL: ${error.message}`);
            console.error('Statement:', trimmedStatement);
            failureCount++;
          } else {
            successCount++;
            process.stdout.write('.'); // Show progress without spamming console
          }
        } catch (err) {
          console.error('Unexpected error:', err);
          failureCount++;
        }
      }
      
      console.log(`\n\n✅ Schema execution complete. Success: ${successCount}, Failures: ${failureCount}`);
      
      // Ask about creating an admin account
      rl.question('\nDo you want to create an admin account now? [Y/n]: ', async (createAdmin) => {
        if (createAdmin.toLowerCase() !== 'n') {
          // Default admin credentials
          const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
          const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
          
          rl.question(`\nUse default admin credentials (${adminEmail})? [Y/n]: `, async (useDefault) => {
            let email = adminEmail;
            let password = adminPassword;
            
            if (useDefault.toLowerCase() === 'n') {
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
              // Sign up admin user
              const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                  data: {
                    name: 'Admin',
                    role: 'admin'
                  }
                }
              });
              
              if (authError) {
                console.error('❌ Error creating admin account:', authError.message);
              } else {
                console.log('✅ Admin account created successfully!');
                console.log(`Email: ${email}`);
                console.log(`Password: ${password}`);
                
                if (!authData.session) {
                  console.log('\nNOTE: Email confirmation may be required before logging in');
                  console.log('Check your email inbox and confirm your account');
                }
              }
            } catch (err) {
              console.error('❌ Error creating admin account:', err.message);
            }
            
            showFinalMessage();
          });
        } else {
          showFinalMessage();
        }
      });
      
    } catch (err) {
      console.error('❌ Unexpected error:', err);
      rl.close();
    }
  });
}

function createSchemaFilePrompt() {
  console.log('\nSchema file is missing. Would you like to create one?');
  rl.question('Create schema file? [Y/n]: ', (createSchema) => {
    if (createSchema.toLowerCase() !== 'n') {
      const defaultSchema = `
-- Create profiles table for storing user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'organizer', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Users can view their own profile
CREATE POLICY "Users can view own profile" 
  ON public.profiles 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" 
  ON public.profiles 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Only authenticated users can insert profiles and only their own
CREATE POLICY "Users can insert own profile" 
  ON public.profiles 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Admin role can do everything
CREATE POLICY "Admins have full access" 
  ON public.profiles 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Function to handle user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'name', new.email), 
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'user')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create a profile when a user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update function for timestamps
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add the timestamp trigger to profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();
`;

      // Ensure directory exists
      const dir = path.dirname(path.join(__dirname, '../backend/supabase-schema.sql'));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Write the default schema
      fs.writeFileSync(path.join(__dirname, '../backend/supabase-schema.sql'), defaultSchema);
      console.log('✅ Default schema file created at backend/supabase-schema.sql');
      console.log('Please edit this file to add additional tables and run the script again.');
      rl.close();
    } else {
      console.log('Operation cancelled. Please create a schema file manually.');
      rl.close();
    }
  });
}

function showFinalMessage() {
  console.log('\n=== Setup Complete ===');
  console.log('The database has been configured successfully!');
  console.log('\nUseful commands:');
  console.log('- npm run manage-accounts   : Manage user accounts');
  console.log('- npm run create-admin      : Create admin account');
  
  rl.close();
}

initializeDatabase();
