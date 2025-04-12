# Cursor MCP Server

This is a Multi-Channel Protocol (MCP) server for Cursor that connects to Supabase for storing and retrieving file data.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up your Supabase project:
   - Create a Supabase project at https://supabase.com
   - Create a table named `files` with the following columns:
     - `id` (uuid, primary key)
     - `path` (text, unique)
     - `content` (text)
     - `updated_at` (timestamp with time zone)

3. Configure your environment variables:
   Create a `.env` file in the root directory with the following variables:
   ```
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_KEY=your_supabase_anon_key
   ```

## Supabase Database Setup

The application uses Supabase for user authentication and database storage. To set up the database:

1. Create a Supabase account at https://supabase.com
2. Create a new project
3. Go to the SQL Editor and run the SQL commands from the `backend/supabase-schema.sql` file to create the tables and functions
4. Update the Supabase URL and API key in the `environment.ts` file

The database setup includes:
- User authentication through Supabase Auth
- User profiles stored in a `profiles` table
- Row-level security policies for secure data access
- Triggers for profile creation when users sign up

## Running the Server

Start the MCP server:
```