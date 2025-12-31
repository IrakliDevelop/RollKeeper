# RollKeeper Backend

Backend server for RollKeeper DM features, providing campaign management, character synchronization, and real-time combat tracking.

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Database**: PostgreSQL (via Supabase)
- **Real-time**: Socket.io
- **Auth**: Supabase Auth (JWT validation)
- **Language**: TypeScript

## Project Structure

```
backend/
├── src/
│   ├── server.ts              # Main server entry point
│   ├── db/
│   │   ├── connection.ts      # PostgreSQL connection pool
│   │   └── migrations/        # Database migrations
│   ├── routes/
│   │   ├── auth.ts            # Authentication routes
│   │   ├── campaigns.ts       # Campaign CRUD
│   │   ├── encounters.ts      # Encounter management
│   │   └── characters.ts      # Character references
│   ├── middleware/
│   │   ├── auth.ts            # JWT validation
│   │   └── errorHandler.ts   # Error handling
│   ├── services/
│   │   ├── campaign.service.ts
│   │   └── encounter.service.ts
│   ├── sockets/
│   │   └── combat.ts          # Real-time combat events
│   ├── types/
│   │   └── index.ts           # Shared types
│   └── utils/
│       └── response.ts        # API response helpers
├── package.json
├── tsconfig.json
└── .env.example
```

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your Supabase credentials:

- `DATABASE_URL`: Get from Supabase Dashboard → Settings → Database → Connection String (Connection Pooling)
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key

### 3. Run Database Migrations

```bash
npm run migrate:up
```

### 4. Start Development Server

```bash
npm run dev
```

Server will start on `http://localhost:4000`

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run migrate:create <name>` - Create new migration
- `npm run migrate:up` - Run pending migrations
- `npm run migrate:down` - Rollback last migration

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Campaigns
- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns` - Create campaign
- `GET /api/campaigns/:id` - Get campaign details
- `PUT /api/campaigns/:id` - Update campaign
- `DELETE /api/campaigns/:id` - Delete campaign

### Encounters (Real-time via Socket.io)
- Connect to Socket.io server at `http://localhost:4000`
- Join encounter room: `socket.emit('join_encounter', { encounterId })`
- Events: `hp_updated`, `initiative_rolled`, `turn_advanced`, etc.

## Development

### Database Migrations

Create a new migration:

```bash
npm run migrate:create add_campaigns_table
```

This creates a new file in `src/db/migrations/`. Edit it:

```typescript
export async function up(pgm) {
  pgm.createTable('campaigns', {
    id: { type: 'uuid', primaryKey: true },
    name: { type: 'varchar(255)', notNull: true },
    // ... more columns
  });
}

export async function down(pgm) {
  pgm.dropTable('campaigns');
}
```

Run migrations:

```bash
npm run migrate:up
```

### Adding New Routes

1. Create route file in `src/routes/`
2. Define endpoints using Express Router
3. Apply auth middleware for protected routes
4. Register route in `src/server.ts`

Example:

```typescript
// src/routes/campaigns.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  // Handle request
});

export default router;
```

## Environment Variables

See `.env.example` for all required environment variables.

## Production Deployment

1. Build the project: `npm run build`
2. Set `NODE_ENV=production`
3. Run: `npm start`
4. Ensure PostgreSQL connection is configured
5. Run migrations: `npm run migrate:up`

## License

MIT
