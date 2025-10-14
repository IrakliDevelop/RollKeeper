# Supabase Setup Guide for RollKeeper

This guide will help you set up a Supabase project for RollKeeper's backend integration.

## Prerequisites

1. A Supabase account (sign up at [supabase.com](https://supabase.com))
2. Node.js and npm installed
3. The RollKeeper project cloned locally

## Step 1: Create a New Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Choose your organization
4. Fill in project details:
   - **Name**: `rollkeeper` (or your preferred name)
   - **Database Password**: Generate a strong password and save it
   - **Region**: Choose the region closest to your users
5. Click "Create new project"
6. Wait for the project to be created (this may take a few minutes)

## Step 2: Get Your Project Credentials

1. In your Supabase dashboard, go to **Settings** > **API**
2. Copy the following values:
   - **Project URL** (something like `https://abcdefghijklmnop.supabase.co`)
   - **anon public** key (starts with `eyJ...`)
   - **service_role** key (starts with `eyJ...`) - Keep this secret!

## Step 3: Set Up Environment Variables

1. In your RollKeeper project root, copy the example environment file:
   ```bash
   cp env.example .env.local
   ```

2. Edit `.env.local` and add your Supabase credentials:
   ```env
   # Supabase Configuration
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

   # Authentication (generate random strings for these)
   JWT_SECRET=your_jwt_secret_key_here_make_it_long_and_random
   JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here_also_long_and_random

   # Real-time Features
   REALTIME_SECRET=your_realtime_secret_key_here

   # Application
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your_nextauth_secret_here
   ```

3. Generate secure random strings for the JWT secrets:
   ```bash
   # You can use Node.js to generate random strings:
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

## Step 4: Run Database Migrations

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New query"
3. Copy the contents of `database/migrations/001_initial_schema.sql` from this project
4. Paste it into the SQL editor
5. Click "Run" to execute the migration
6. You should see "Success. No rows returned" if everything worked correctly

## Step 5: Configure Authentication

1. In your Supabase dashboard, go to **Authentication** > **Settings**
2. Under **Site URL**, add your development URL: `http://localhost:3000`
3. Under **Redirect URLs**, add: `http://localhost:3000/auth/callback`
4. Disable email confirmation for development (optional):
   - Go to **Authentication** > **Settings** > **Email**
   - Turn off "Enable email confirmations"

## Step 6: Enable Real-time (Optional)

1. In your Supabase dashboard, go to **Database** > **Replication**
2. Enable replication for the following tables if you want real-time subscriptions:
   - `characters`
   - `character_updates`
   - `campaign_members`
   - `realtime_sessions`

## Step 7: Test the Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Try to register a new user by visiting the app and using the authentication features

3. Check your Supabase dashboard under **Authentication** > **Users** to see if the user was created

## Step 8: Production Setup (When Ready)

For production deployment:

1. Add your production domain to the Site URL and Redirect URLs in Supabase
2. Update your environment variables in your hosting platform (Vercel, Netlify, etc.)
3. Consider enabling Row Level Security policies (already included in the migration)
4. Set up proper backup and monitoring

## Troubleshooting

### Common Issues

1. **"Invalid JWT" errors**: Make sure your JWT secrets are properly set and match between your app and environment
2. **Database connection errors**: Verify your Supabase URL and keys are correct
3. **RLS policy errors**: The migration includes Row Level Security policies that might need adjustment based on your auth setup

### Useful Supabase Dashboard Sections

- **Database** > **Tables**: View and edit your data
- **Authentication** > **Users**: Manage user accounts
- **SQL Editor**: Run custom queries and migrations
- **Logs** > **Database**: View database logs for debugging

### Support

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord Community](https://discord.supabase.com)
- [RollKeeper GitHub Issues](https://github.com/your-repo/rollkeeper/issues)

## Next Steps

Once your Supabase project is set up:

1. Test user registration and login
2. Create a campaign and invite users
3. Test real-time character updates
4. Explore the DM tools with multiple users

Your RollKeeper app should now have full backend functionality with user authentication, real-time sync, and cloud storage!
