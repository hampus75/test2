-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table (similar to Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'organizer', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'organizer', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create events table
CREATE TABLE events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  deadline TEXT NOT NULL,
  description TEXT,
  location TEXT NOT NULL,
  organizer TEXT NOT NULL,
  organizer_id UUID REFERENCES profiles(user_id),
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

-- Create checkpoints table
CREATE TABLE checkpoints (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  distance FLOAT NOT NULL,
  opening_time TIMESTAMPTZ,
  closing_time TIMESTAMPTZ,
  image_path TEXT,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create participants table
CREATE TABLE participants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
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

-- Create participant_checkpoints table
CREATE TABLE participant_checkpoints (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  checkpoint_id UUID REFERENCES checkpoints(id) ON DELETE CASCADE,
  check_in_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create files table for MCP server
CREATE TABLE files (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create timestamp function for automatic updates
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update trigger to all tables
CREATE TRIGGER update_profiles_modified
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_events_modified
BEFORE UPDATE ON events
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_checkpoints_modified
BEFORE UPDATE ON checkpoints
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_participants_modified
BEFORE UPDATE ON participants
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_participant_checkpoints_modified
BEFORE UPDATE ON participant_checkpoints
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_files_modified
BEFORE UPDATE ON files
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Create indexes for better performance
CREATE INDEX events_organizer_id_idx ON events(organizer_id);
CREATE INDEX checkpoints_event_id_idx ON checkpoints(event_id);
CREATE INDEX participants_event_id_idx ON participants(event_id);
CREATE INDEX participants_user_id_idx ON participants(user_id);
CREATE INDEX participants_registration_code_idx ON participants(registration_code);
CREATE INDEX participant_checkpoints_participant_id_idx ON participant_checkpoints(participant_id);
CREATE INDEX participant_checkpoints_checkpoint_id_idx ON participant_checkpoints(checkpoint_id);
