#!/usr/bin/env node

// Import required modules
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from environment.ts
let supabaseUrl = '';
let supabaseKey = '';

try {
  // Read the environment.ts file to extract Supabase credentials
  const envFilePath = path.join(__dirname, '../src/environments/environment.ts');
  const envFileContent = fs.readFileSync(envFilePath, 'utf8');
  
  // Extract the URL and key using regex
  const urlMatch = envFileContent.match(/url: '(.*?)'/);
  const keyMatch = envFileContent.match(/key: '(.*?)'/);
  
  if (urlMatch && keyMatch) {
    supabaseUrl = urlMatch[1];
    supabaseKey = keyMatch[1];
    console.log('Successfully extracted Supabase credentials from environment.ts');
  } else {
    throw new Error('Could not find Supabase URL or key in environment.ts');
  }
} catch (error) {
  console.error('Error loading environment configuration:', error.message);
  console.error('Falling back to default values if available');
  
  // Fallback to hardcoded values from the file we saw
  supabaseUrl = 'https://mvsjphhkrrinxdrevoqy.supabase.co';
  supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12c2pwaGhrcnJpbnhkcmV2b3F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM5NTIzNzksImV4cCI6MjA1OTUyODM3OX0.obnnj5AE8oF3Qzibii3pmChgvgiGbG9L-lkUY-bsHMo';
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Database setup function
async function initializeDatabase() {
  console.log('Starting database initialization...');
  
  try {
    // Step 1: Create profiles table if it doesn't exist
    console.log('\nStep 1: Creating profiles table...');
    
    const profilesSQL = `
      CREATE TABLE IF NOT EXISTS public.profiles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        email TEXT,
        role TEXT NOT NULL CHECK (role IN ('admin', 'organizer', 'user')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      -- Enable RLS
      ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
      
      -- Policies
      CREATE POLICY IF NOT EXISTS "Users can view own profile" ON public.profiles
        FOR SELECT USING (auth.uid() = user_id);
        
      CREATE POLICY IF NOT EXISTS "Users can update own profile" ON public.profiles
        FOR UPDATE USING (auth.uid() = user_id);
        
      CREATE POLICY IF NOT EXISTS "Users can insert own profile" ON public.profiles
        FOR INSERT WITH CHECK (auth.uid() = user_id);
        
      CREATE POLICY IF NOT EXISTS "Admins have full access" ON public.profiles
        USING (EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE user_id = auth.uid() AND role = 'admin'
        ));
    `;
    
    // Execute the SQL to create profiles table
    const { error: profilesError } = await supabase.rpc('exec_sql', { sql: profilesSQL });
    
    if (profilesError) {
      console.error('Error creating profiles table:', profilesError.message);
      console.log('You may need to run this SQL manually in the Supabase SQL editor');
    } else {
      console.log('✅ Profiles table configured successfully');
    }
    
    // Step 2: Create update timestamp function
    console.log('\nStep 2: Creating updated_at trigger function...');
    
    const timestampSQL = `
      CREATE OR REPLACE FUNCTION public.update_modified_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      -- Add triggers to profiles table
      DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
      CREATE TRIGGER update_profiles_updated_at
        BEFORE UPDATE ON public.profiles
        FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
    `;
    
    const { error: timestampError } = await supabase.rpc('exec_sql', { sql: timestampSQL });
    
    if (timestampError) {
      console.error('Error creating timestamp function:', timestampError.message);
      console.log('You may need to run this SQL manually in the Supabase SQL editor');
    } else {
      console.log('✅ Updated_at trigger function created successfully');
    }
    
    // Step 3: Create user trigger function
    console.log('\nStep 3: Creating user trigger function...');
    
    const userTriggerSQL = `
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
      
      -- Add trigger to auth.users table
      DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
      CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    `;
    
    const { error: userTriggerError } = await supabase.rpc('exec_sql', { sql: userTriggerSQL });
    
    if (userTriggerError) {
      console.error('Error creating user trigger function:', userTriggerError.message);
      console.log('You may need to run this SQL manually in the Supabase SQL editor');
    } else {
      console.log('✅ User trigger function created successfully');
    }
    
    // Step 4: Create events table
    console.log('\nStep 4: Creating events table...');
    
    const eventsSQL = `
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
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      -- Enable RLS
      ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
      
      -- Everyone can view events
      CREATE POLICY IF NOT EXISTS "Events are viewable by everyone" 
        ON public.events 
        FOR SELECT USING (true);
        
      -- Organizers and admins can create events
      CREATE POLICY IF NOT EXISTS "Organizers and admins can create events" 
        ON public.events 
        FOR INSERT WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid() AND (role = 'organizer' OR role = 'admin')
          )
        );
        
      -- Organizers can update their own events, admins can update any
      CREATE POLICY IF NOT EXISTS "Organizers can update own events" 
        ON public.events 
        FOR UPDATE USING (
          organizer_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid() AND role = 'admin'
          )
        );
        
      -- Add timestamp trigger
      DROP TRIGGER IF EXISTS update_events_updated_at ON public.events;
      CREATE TRIGGER update_events_updated_at
        BEFORE UPDATE ON public.events
        FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
    `;
    
    const { error: eventsError } = await supabase.rpc('exec_sql', { sql: eventsSQL });
    
    if (eventsError) {
      console.error('Error creating events table:', eventsError.message);
      console.log('You may need to run this SQL manually in the Supabase SQL editor');
    } else {
      console.log('✅ Events table configured successfully');
    }
    
    // Step 5: Create checkpoints table
    console.log('\nStep 5: Creating checkpoints table...');
    
    const checkpointsSQL = `
      CREATE TABLE IF NOT EXISTS public.checkpoints (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        distance FLOAT NOT NULL,
        opening_time TIMESTAMPTZ,
        closing_time TIMESTAMPTZ,
        image_path TEXT,
        location TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      -- Enable RLS
      ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;
      
      -- Everyone can view checkpoints
      CREATE POLICY IF NOT EXISTS "Checkpoints are viewable by everyone" 
        ON public.checkpoints 
        FOR SELECT USING (true);
        
      -- Add timestamp trigger
      DROP TRIGGER IF EXISTS update_checkpoints_updated_at ON public.checkpoints;
      CREATE TRIGGER update_checkpoints_updated_at
        BEFORE UPDATE ON public.checkpoints
        FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
    `;
    
    const { error: checkpointsError } = await supabase.rpc('exec_sql', { sql: checkpointsSQL });
    
    if (checkpointsError) {
      console.error('Error creating checkpoints table:', checkpointsError.message);
      console.log('You may need to run this SQL manually in the Supabase SQL editor');
    } else {
      console.log('✅ Checkpoints table configured successfully');
    }
    
    // Step 6: Create participants table
    console.log('\nStep 6: Creating participants table...');
    
    const participantsSQL = `
      CREATE TABLE IF NOT EXISTS public.participants (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
        user_id UUID REFERENCES auth.users(id),
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        club TEXT,
        registration_code TEXT NOT NULL,
        registration_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      -- Enable RLS
      ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
      
      -- Everyone can sign up for events
      CREATE POLICY IF NOT EXISTS "Users can register for events" 
        ON public.participants 
        FOR INSERT WITH CHECK (true);
        
      -- Users can view their own registrations
      CREATE POLICY IF NOT EXISTS "Users can view own registrations" 
        ON public.participants 
        FOR SELECT USING (user_id = auth.uid());
        
      -- Add timestamp trigger
      DROP TRIGGER IF EXISTS update_participants_updated_at ON public.participants;
      CREATE TRIGGER update_participants_updated_at
        BEFORE UPDATE ON public.participants
        FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
    `;
    
    const { error: participantsError } = await supabase.rpc('exec_sql', { sql: participantsSQL });
    
    if (participantsError) {
      console.error('Error creating participants table:', participantsError.message);
      console.log('You may need to run this SQL manually in the Supabase SQL editor');
    } else {
      console.log('✅ Participants table configured successfully');
    }
    
    // Step 7: Create participant_checkpoints table
    console.log('\nStep 7: Creating participant_checkpoints table...');
    
    const participantCheckpointsSQL = `
      CREATE TABLE IF NOT EXISTS public.participant_checkpoints (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        participant_id UUID REFERENCES public.participants(id) ON DELETE CASCADE,
        checkpoint_id UUID REFERENCES public.checkpoints(id) ON DELETE CASCADE,
        check_in_time TIMESTAMPTZ,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      -- Enable RLS
      ALTER TABLE public.participant_checkpoints ENABLE ROW LEVEL SECURITY;
      
      -- Everyone can view checkpoint statuses
      CREATE POLICY IF NOT EXISTS "Public can view checkpoint statuses" 
        ON public.participant_checkpoints 
        FOR SELECT USING (true);
        
      -- Add timestamp trigger
      DROP TRIGGER IF EXISTS update_participant_checkpoints_updated_at ON public.participant_checkpoints;
      CREATE TRIGGER update_participant_checkpoints_updated_at
        BEFORE UPDATE ON public.participant_checkpoints
        FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
    `;
    
    const { error: participantCheckpointsError } = await supabase.rpc('exec_sql', { sql: participantCheckpointsSQL });
    
    if (participantCheckpointsError) {
      console.error('Error creating participant_checkpoints table:', participantCheckpointsError.message);
      console.log('You may need to run this SQL manually in the Supabase SQL editor');
    } else {
      console.log('✅ Participant_checkpoints table configured successfully');
    }
    
    // Step 8: Create indexes for better performance
    console.log('\nStep 8: Creating indexes...');
    
    const indexesSQL = `
      CREATE INDEX IF NOT EXISTS events_organizer_id_idx ON public.events(organizer_id);
      CREATE INDEX IF NOT EXISTS checkpoints_event_id_idx ON public.checkpoints(event_id);
      CREATE INDEX IF NOT EXISTS participants_event_id_idx ON public.participants(event_id);
      CREATE INDEX IF NOT EXISTS participants_user_id_idx ON public.participants(user_id);
      CREATE INDEX IF NOT EXISTS participants_registration_code_idx ON public.participants(registration_code);
      CREATE INDEX IF NOT EXISTS participant_checkpoints_participant_id_idx ON public.participant_checkpoints(participant_id);
      CREATE INDEX IF NOT EXISTS participant_checkpoints_checkpoint_id_idx ON public.participant_checkpoints(checkpoint_id);
    `;
    
    const { error: indexesError } = await supabase.rpc('exec_sql', { sql: indexesSQL });
    
    if (indexesError) {
      console.error('Error creating indexes:', indexesError.message);
      console.log('You may need to run this SQL manually in the Supabase SQL editor');
    } else {
      console.log('✅ Indexes created successfully');
    }
    
    console.log('\n✅ Database initialization completed!');
    console.log('\nTo create an admin account, run: npm run create-admin');
    
  } catch (error) {
    console.error('\n❌ Database initialization failed:', error.message);
    console.error('You may need to run the SQL statements manually in the Supabase SQL Editor.');
  }
}

// Run the initialization
initializeDatabase();
