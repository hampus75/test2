#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Get Supabase credentials from environment
const supabaseUrl = process.env.SUPABASE_URL || 'https://cxevzikcudqrwxiexysk.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4ZXZ6aWtjdWRxcnd4aWV4eXNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4NDEwMzMsImV4cCI6MjA1OTQxNzAzM30.2GORWFr-XbpoepGp_14aSVUzXu4Drasxv3IrJz8lRX8';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
  console.log('Starting database setup...');
  
  try {
    // Step 1: Create profiles table if it doesn't exist
    console.log('\nStep 1: Creating profiles table...');
    const { error: checkError } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    // If table doesn't exist, create it
    if (checkError && checkError.message.includes('does not exist')) {
      console.log('Profiles table does not exist, creating it...');
      
      // Try using the SQL API 
      const createTableSQL = `
      CREATE TABLE IF NOT EXISTS public.profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'organizer', 'user')),
        email TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      -- Enable RLS
      ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
      
      -- Policies
      CREATE POLICY "Users can view own profile" ON public.profiles
        FOR SELECT USING (auth.uid() = user_id);
        
      CREATE POLICY "Users can update own profile" ON public.profiles
        FOR UPDATE USING (auth.uid() = user_id);
        
      CREATE POLICY "Users can insert own profile" ON public.profiles
        FOR INSERT WITH CHECK (auth.uid() = user_id);
        
      CREATE POLICY "Admins have full access" ON public.profiles
        USING (EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE user_id = auth.uid() AND role = 'admin'
        ));
      `;
      
      // Try SQL execution API if available
      const { error: sqlError } = await supabase.rpc('exec_sql', {
        sql: createTableSQL
      });
      
      if (sqlError) {
        console.error('Failed to create table via SQL:', sqlError.message);
        console.log('You may need to go to the Supabase SQL editor and run this SQL directly:');
        console.log(createTableSQL);
        console.log('\nContinuing setup...');
      } else {
        console.log('✅ Created profiles table successfully');
      }
    } else if (checkError) {
      console.error('Error checking for profiles table:', checkError.message);
    } else {
      console.log('✅ Profiles table already exists');
    }
    
    // Step 2: Create SQL function to automatically update timestamps
    console.log('\nStep 2: Creating updated_at trigger function...');
    
    const updateTimestampSQL = `
    CREATE OR REPLACE FUNCTION public.update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ language 'plpgsql';
    
    DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
    
    CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    `;
    
    const { error: timestampError } = await supabase.rpc('exec_sql', {
      sql: updateTimestampSQL
    });
    
    if (timestampError) {
      console.error('Failed to create timestamp function:', timestampError.message);
      console.log('You may need to go to the Supabase SQL editor and run this SQL directly');
    } else {
      console.log('✅ Created updated_at trigger function');
    }
    
    // Step 3: Create custom functions for handling user creation
    console.log('\nStep 3: Creating custom functions...');
    
    const handleNewUserSQL = `
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
    
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    `;
    
    const { error: functionError } = await supabase.rpc('exec_sql', {
      sql: handleNewUserSQL
    });
    
    if (functionError) {
      console.error('Failed to create user handling function:', functionError.message);
      console.log('You may need to go to the Supabase SQL editor and run this SQL directly');
    } else {
      console.log('✅ Created user handling function');
    }
    
    // Step 4: Set up events table if needed
    console.log('\nStep 4: Creating events table...');
    const eventsTableSQL = `
    CREATE TABLE IF NOT EXISTS public.events (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      deadline TEXT NOT NULL,
      description TEXT,
      location TEXT NOT NULL,
      organizer TEXT NOT NULL,
      organizer_id UUID REFERENCES public.profiles(user_id),
      type TEXT NOT NULL,
      distance INTEGER NOT NULL,
      elevation INTEGER,
      payment_method TEXT,
      route_link TEXT,
      gpx_file_path TEXT,
      image_path TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    -- Enable RLS
    ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
    
    -- Everyone can view events
    CREATE POLICY "Events are viewable by everyone" ON public.events
      FOR SELECT USING (true);
      
    -- Organizers and admins can insert events
    CREATE POLICY "Organizers and admins can create events" ON public.events
      FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND (role = 'organizer' OR role = 'admin')
      ));
      
    -- Organizers can only update their own events, admins can update any
    CREATE POLICY "Organizers can update own events" ON public.events
      FOR UPDATE USING (
        organizer_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE user_id = auth.uid() AND role = 'admin'
        )
      );
    `;
    
    const { error: eventsError } = await supabase.rpc('exec_sql', {
      sql: eventsTableSQL
    });
    
    if (eventsError) {
      console.error('Failed to create events table:', eventsError.message);
      console.log('You may need to go to the Supabase SQL editor and run this SQL directly');
    } else {
      console.log('✅ Created events table');
    }
    
    console.log('\nDatabase setup completed!');
    console.log('\nNow you can run "npm run create-admin" to create an admin account or check existing users.');
    
  } catch (error) {
    console.error('Unexpected error during setup:', error.message);
  }
}

setupDatabase();