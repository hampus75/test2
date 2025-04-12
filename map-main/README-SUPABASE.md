# Supabase Database Setup

The application uses Supabase for user authentication and database storage. This guide walks you through setting up the necessary database structures.

## Initial Setup

1. Create a Supabase account at https://supabase.com
2. Create a new project
3. Set up your environment variables by copying `.env.example` to `.env` and filling in your Supabase URL and API key:
```
<copilot-edited-file>
````

```bash
npm run setup-supabase
```

This script will:
- Create the necessary tables and functions
- Set up Row Level Security policies
- Create a default admin user if one doesn't exist

### Manual Setup
Alternatively, you can manually set up the database:

1. Go to the SQL Editor in your Supabase project
2. Run the SQL commands from the `backend/supabase-schema.sql` file
3. Update the Supabase URL and API key in the `angularSetup/src/environments/environment.ts` file

## Database Schema

The database setup includes:

- User authentication through Supabase Auth
- User profiles stored in a `profiles` table with the following structure:
  - `id`: Primary key UUID
  - `user_id`: Foreign key referencing auth.users
  - `name`: User's full name
  - `role`: User role (admin, organizer, or user)
  - `created_at`: Creation timestamp
  - `updated_at`: Last update timestamp

## Security

The database implements Row Level Security (RLS) policies:

- Users can only view and update their own profiles
- Admin users have full access to all profiles
- A trigger automatically creates a profile when a new user signs up

## Integration with Angular

The Angular application connects to Supabase using the `@supabase/supabase-js` client library:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  environment.supabase.url,
  environment.supabase.key
);
```

## Authentication Flow

1. User signs up or logs in using Supabase Auth
2. On successful authentication, a JWT token is returned
3. The token is used for subsequent API calls
4. The AuthService maintains the current user state

## Default Admin Account

During initialization, the system checks if an admin account exists and creates one if needed using the credentials specified in the environment file:

```typescript
// Default admin credentials
defaultAdminEmail: 'admin@example.com',
defaultAdminPassword: 'Admin123!'
```

## Local Development

For local development:

1. Use the Supabase local development setup or connect to your Supabase project
2. Make sure your environment.ts has the correct Supabase URL and API key
3. Run the SQL setup script to create necessary tables and functions
4. Test authentication using the login form on the home page 