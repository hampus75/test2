-- Enable the UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 1: Create timestamp update function
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create or update profiles table
DO $$ 
BEGIN
    -- Check if profiles table exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
        -- Table exists, check if the unique constraint exists on user_id
        IF NOT EXISTS (
            SELECT FROM pg_constraint 
            WHERE conrelid = 'public.profiles'::regclass 
            AND contype = 'u' 
            AND conkey @> ARRAY[
                (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.profiles'::regclass AND attname = 'user_id')
            ]
        ) THEN
            -- Add unique constraint if it doesn't exist
            ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
            RAISE NOTICE 'Added unique constraint to user_id in profiles table';
        END IF;
    ELSE
        -- Create table with unique constraint
        CREATE TABLE public.profiles (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
          name TEXT NOT NULL,
          email TEXT,
          role TEXT NOT NULL CHECK (role IN ('admin', 'organizer', 'user')),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        RAISE NOTICE 'Created profiles table with unique constraint on user_id';
    END IF;
END $$;

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Add timestamp trigger to profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- Step 3: Create profiles policies
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

-- Users can insert their own profile
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

-- Step 4: Create new user handler function
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

-- Create trigger for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 5: Create events table
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

-- Enable RLS for events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Add timestamp trigger to events
DROP TRIGGER IF EXISTS update_events_updated_at ON public.events;
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- Step 6: Create events policies
-- Everyone can view events
CREATE POLICY "Events are viewable by everyone" 
  ON public.events 
  FOR SELECT USING (true);

-- Organizers and admins can create events
CREATE POLICY "Organizers and admins can create events" 
  ON public.events 
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND (role = 'organizer' OR role = 'admin')
    )
  );

-- Organizers can update their own events, admins can update any
CREATE POLICY "Organizers can update own events" 
  ON public.events 
  FOR UPDATE USING (
    organizer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Step 7: Create checkpoints table
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

-- Enable RLS for checkpoints
ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;

-- Add timestamp trigger to checkpoints
DROP TRIGGER IF EXISTS update_checkpoints_updated_at ON public.checkpoints;
CREATE TRIGGER update_checkpoints_updated_at
  BEFORE UPDATE ON public.checkpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- Step 8: Create checkpoints policies
-- Everyone can view checkpoints
CREATE POLICY "Checkpoints are viewable by everyone" 
  ON public.checkpoints 
  FOR SELECT USING (true);

-- Only event organizers and admins can modify checkpoints
CREATE POLICY "Organizers and admins can modify checkpoints" 
  ON public.checkpoints 
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.profiles p ON e.organizer_id = p.user_id
      WHERE e.id = event_id AND 
      (p.user_id = auth.uid() OR 
       EXISTS (
         SELECT 1 FROM public.profiles 
         WHERE user_id = auth.uid() AND role = 'admin'
       ))
    )
  );

-- Step 9: Create participants table
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

-- Enable RLS for participants
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

-- Add timestamp trigger to participants
DROP TRIGGER IF EXISTS update_participants_updated_at ON public.participants;
CREATE TRIGGER update_participants_updated_at
  BEFORE UPDATE ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- Step 10: Create participants policies
-- Everyone can sign up for events
CREATE POLICY "Users can register for events" 
  ON public.participants 
  FOR INSERT WITH CHECK (true);

-- Users can view their own registrations
CREATE POLICY "Users can view own registrations" 
  ON public.participants 
  FOR SELECT USING (user_id = auth.uid());

-- Event organizers can view all participants for their events
CREATE POLICY "Organizers can view event participants" 
  ON public.participants 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.profiles p ON e.organizer_id = p.user_id
      WHERE e.id = event_id AND p.user_id = auth.uid()
    )
  );

-- Admins can view all participants
CREATE POLICY "Admins can view all participants" 
  ON public.participants 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Step 11: Create participant_checkpoints table
CREATE TABLE IF NOT EXISTS public.participant_checkpoints (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  participant_id UUID REFERENCES public.participants(id) ON DELETE CASCADE,
  checkpoint_id UUID REFERENCES public.checkpoints(id) ON DELETE CASCADE,
  check_in_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for participant_checkpoints
ALTER TABLE public.participant_checkpoints ENABLE ROW LEVEL SECURITY;

-- Add timestamp trigger to participant_checkpoints
DROP TRIGGER IF EXISTS update_participant_checkpoints_updated_at ON public.participant_checkpoints;
CREATE TRIGGER update_participant_checkpoints_updated_at
  BEFORE UPDATE ON public.participant_checkpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- Step 12: Create participant_checkpoints policies
-- Everyone can view checkpoint statuses
CREATE POLICY "Public can view checkpoint statuses" 
  ON public.participant_checkpoints 
  FOR SELECT USING (true);

-- Only organizers and admins can update checkpoint statuses
CREATE POLICY "Only organizers and admins can update checkpoints" 
  ON public.participant_checkpoints 
  USING (
    EXISTS (
      SELECT 1 FROM public.participants p
      JOIN public.events e ON p.event_id = e.id
      JOIN public.profiles pr ON e.organizer_id = pr.user_id
      WHERE p.id = participant_id AND 
      (pr.user_id = auth.uid() OR 
       EXISTS (
         SELECT 1 FROM public.profiles 
         WHERE user_id = auth.uid() AND role = 'admin'
       ))
    )
  );

-- Step 13: Create indexes for better performance
CREATE INDEX IF NOT EXISTS events_organizer_id_idx ON public.events(organizer_id);
CREATE INDEX IF NOT EXISTS checkpoints_event_id_idx ON public.checkpoints(event_id);
CREATE INDEX IF NOT EXISTS participants_event_id_idx ON public.participants(event_id);
CREATE INDEX IF NOT EXISTS participants_user_id_idx ON public.participants(user_id);
CREATE INDEX IF NOT EXISTS participants_registration_code_idx ON public.participants(registration_code);
CREATE INDEX IF NOT EXISTS participant_checkpoints_participant_id_idx ON public.participant_checkpoints(participant_id);
CREATE INDEX IF NOT EXISTS participant_checkpoints_checkpoint_id_idx ON public.participant_checkpoints(checkpoint_id);