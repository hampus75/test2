# Supabase Setup for Cycling Event Management System

This document provides instructions for setting up Supabase as the backend database for the cycling event management application.

## 1. Create a Supabase Project

1. Go to [Supabase](https://supabase.com/) and sign up or log in
2. Create a new project
3. Choose a name for your project (e.g., "cycling-events")
4. Choose a strong database password (save it somewhere safe)
5. Select a region closest to your users
6. Wait for your project to be created (usually takes a few minutes)

## 2. Get Your Supabase Credentials

1. Once your project is created, go to the project dashboard
2. Click on the "Settings" icon in the left sidebar
3. Select "API" from the menu
4. Copy the "Project URL" and "anon public" key
5. Update these values in your environment.ts file:

```typescript
supabase: {
  url: 'YOUR_SUPABASE_URL', // The Project URL
  key: 'YOUR_SUPABASE_ANON_KEY', // The anon public key
  buckets: {
    events: 'event-images',
    checkpoints: 'checkpoint-images',
    gpx: 'gpx-files'
  }
}
```

## 3. Create Database Tables

In the Supabase dashboard, go to the "SQL Editor" and run the following SQL statements to create your database schema:

```sql
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
  type TEXT NOT NULL,
  distance INTEGER NOT NULL,
  elevation INTEGER,
  payment_method TEXT,
  route_link TEXT,
  gpx_file_path TEXT,
  image_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create participants table
CREATE TABLE participants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  club TEXT,
  registration_code TEXT NOT NULL,
  registration_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create participant_checkpoints table
CREATE TABLE participant_checkpoints (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  checkpoint_id TEXT NOT NULL,
  check_in_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster querying
CREATE INDEX events_date_idx ON events(date);
CREATE INDEX checkpoints_event_id_idx ON checkpoints(event_id);
CREATE INDEX participants_event_id_idx ON participants(event_id);
CREATE INDEX participants_registration_code_idx ON participants(registration_code);
CREATE INDEX participant_checkpoints_participant_id_idx ON participant_checkpoints(participant_id);
```

## 4. Create Storage Buckets

1. In the Supabase dashboard, go to "Storage" in the left sidebar
2. Create the following buckets:
   - `event-images` (for event images)
   - `checkpoint-images` (for checkpoint images)
   - `gpx-files` (for GPX route files)
3. For each bucket, set the access permissions:
   - Public access for viewing (so images can be displayed in the app)
   - Authenticated uploads (so only authenticated users can upload)

## 5. Update RLS Policies

For production use, you should set up Row Level Security (RLS) policies:

1. Go to the "Authentication" section in the Supabase dashboard
2. Create appropriate RLS policies for each table to control access
3. For example, you might want to:
   - Allow anyone to read events and checkpoints
   - Only allow event organizers to create/update events
   - Only allow registered participants to check in at checkpoints

## 6. Test Your Setup

1. Update the environment.ts file with your Supabase credentials
2. Start your Angular application
3. Create a test event to verify that data is being stored in Supabase
4. Check the Supabase dashboard to confirm the data was inserted correctly

## Migrating Existing Data

If you have existing data in localStorage, you can migrate it to Supabase:

1. The current application has fallback mechanisms to use localStorage
2. When users create events or register, the data will be saved to both Supabase and localStorage
3. Gradually, all data will migrate to Supabase as users interact with the application

## Troubleshooting

- Check the browser console for error messages
- Verify your Supabase credentials in the environment.ts file
- Ensure your database tables match the expected schema
- Check network requests in browser dev tools to see API calls to Supabase 