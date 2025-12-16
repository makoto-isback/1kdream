# ADream Backend API

NestJS backend for Telegram Mini App with PostgreSQL (Supabase) connection.

## Features

- ✅ Telegram WebApp authentication
- ✅ PostgreSQL/Supabase database connection
- ✅ User management with KYAT balance & points
- ✅ REST API structure
- ✅ JWT authentication

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

**For Supabase:**
1. Go to your Supabase project
2. Navigate to Settings > Database
3. Copy the connection string or use individual credentials

```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

### 3. Run Database Migrations

The app uses TypeORM with `synchronize: true` in development, which will auto-create tables.

For production, use migrations:
```bash
npm run migration:generate -- -n InitialMigration
npm run migration:run
```

### 4. Start the Server

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## API Endpoints

### Authentication

**POST** `/auth/telegram`
- Login with Telegram WebApp init data
- Body: `{ id, first_name, last_name, username, auth_date, hash }`
- Returns: `{ access_token, user }`

**GET** `/auth/me`
- Get current authenticated user
- Headers: `Authorization: Bearer <token>`

### Users

**GET** `/users/me`
- Get current user profile
- Headers: `Authorization: Bearer <token>`

**GET** `/users/balance`
- Get user balance and points
- Headers: `Authorization: Bearer <token>`
- Returns: `{ kyatBalance, points }`

### Health

**GET** `/health`
- Health check endpoint

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "telegramId" VARCHAR UNIQUE NOT NULL,
  username VARCHAR,
  "firstName" VARCHAR,
  "lastName" VARCHAR,
  "kyatBalance" DECIMAL(18, 2) DEFAULT 0,
  points DECIMAL(18, 2) DEFAULT 0,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Project Structure

```
src/
├── modules/
│   ├── auth/          # Telegram authentication
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.module.ts
│   │   └── guards/
│   │       └── jwt-auth.guard.ts
│   └── users/         # User management
│       ├── users.controller.ts
│       ├── users.service.ts
│       ├── users.module.ts
│       └── entities/
│           └── user.entity.ts
├── database/          # Database configuration
│   └── database.module.ts
├── app.module.ts
├── app.controller.ts
├── app.service.ts
└── main.ts
```

## Development

```bash
# Watch mode
npm run start:dev

# Build
npm run build

# Production mode
npm run start:prod
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | Secret key for JWT tokens | Yes |
| `JWT_EXPIRES_IN` | JWT token expiration (default: 7d) | No |
| `NODE_ENV` | Environment (development/production) | No |
| `PORT` | Server port (default: 3000) | No |
| `FRONTEND_URL` | Frontend URL for CORS | No |

## Next Steps

- Add lottery logic
- Add betting system
- Add wallet/deposit/withdrawal functionality
- Add admin panel

