# ADream - Telegram Mini App

A complete Telegram Mini App lottery system with TON blockchain integration for USDT deposits and withdrawals.

## Project Structure

```
adream/
├── apps/
│   ├── frontend-miniapp/     # React + Telegram WebApp SDK
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── components/   # Grid, Countdown, Wallet, Modal
│   │   │   ├── pages/        # Home, Lottery, Wallet, Support
│   │   │   ├── services/     # API client
│   │   │   ├── i18n/         # Burmese translations
│   │   │   └── styles/       # CSS files
│   │   └── package.json
│   │
│   ├── backend-api/          # NestJS API
│   │   ├── src/
│   │   │   ├── modules/     # auth, users, lottery, bets, wallet, admin
│   │   │   ├── jobs/        # hourly-draw.job.ts
│   │   │   ├── ton/         # TON blockchain integration
│   │   │   └── database/    # Database configuration
│   │   └── package.json
│   │
│   └── admin-panel/         # Admin panel (placeholder)
│
├── prisma/                   # Database schema (optional)
├── docs/                     # Documentation
│   ├── architecture.md
│   ├── security.md
│   └── legal.md
│
└── README.md
```

## Features

- 🎰 **Hourly Lottery**: 25 blocks (01-25), draws every hour
- 💰 **In-Game Currency**: KYAT (off-chain)
- 💵 **Blockchain Integration**: TON USDT deposits & withdrawals
- 📱 **Telegram Mini App**: Mobile-first design
- 🌐 **Burmese Language**: Full localization
- ⚡ **Real-time Updates**: Live lottery countdown
- 🎯 **Proportional Payouts**: Winners share 90% pool based on bet size
- 🏆 **Points System**: 10 points per bet

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database (or Supabase)
- Telegram Bot Token

### Installation

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd apps/frontend-miniapp && npm install

# Install backend dependencies
cd ../backend-api && npm install
```

### Configuration

**Backend** (`apps/backend-api/.env`):
```env
DATABASE_URL=postgresql://user:password@localhost:5432/adream
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
TELEGRAM_BOT_TOKEN=your-bot-token
TON_WALLET_ADDRESS=your-ton-wallet-address
TON_NETWORK=mainnet
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
```

**Frontend** (`apps/frontend-miniapp/.env`):
```env
VITE_API_URL=http://localhost:3000
```

### Running

```bash
# From root directory

# Start backend
npm run dev:backend

# Start frontend (in another terminal)
npm run dev:frontend
```

## Business Logic

- **Exchange Rate**: 1 USD = 5,000 KYAT
- **Minimum Deposit**: 1,000 KYAT (0.2 USDT)
- **Minimum Withdrawal**: 5,000 KYAT (1 USDT)
- **Minimum Bet**: 1,000 KYAT
- **Admin Fee**: 10% per round
- **Winner Pool**: 90% distributed proportionally
- **Points**: 10 points per bet

## API Endpoints

See `docs/architecture.md` for complete API documentation.

## License

Private - All rights reserved
