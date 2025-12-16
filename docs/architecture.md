# Architecture Overview

## System Architecture

```
┌─────────────────┐
│  Telegram App   │
│  (Mini App)     │
└────────┬────────┘
         │
         │ HTTPS
         │
┌────────▼────────┐
│  Frontend       │
│  (React + Vite) │
└────────┬────────┘
         │
         │ REST API
         │
┌────────▼────────┐
│  Backend API   │
│  (NestJS)      │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│  DB   │ │  TON  │
│(PG)   │ │Blockchain│
└───────┘ └───────┘
```

## Data Flow

### Betting Flow
1. User selects block (1-25) and amount
2. Frontend sends POST /bets
3. Backend validates:
   - Block number (1-25)
   - Amount (min 1,000 KYAT)
   - User balance
4. Backend:
   - Deducts KYAT from user
   - Adds 10 points
   - Creates bet record
   - Updates lottery round pool
5. Returns bet confirmation

### Lottery Draw Flow (Hourly Cron)
1. Cron job triggers at :00 every hour
2. System checks active round
3. If draw time reached:
   - Selects random block (1-25)
   - Finds all winning bets
   - Calculates proportional payouts
   - Distributes 90% pool to winners
   - Marks round as completed
   - Creates new round for next hour

### Deposit Flow
1. User enters USDT amount
2. Frontend requests deposit address
3. Backend returns TON wallet address
4. User sends USDT to address
5. Admin confirms transaction (manual/automated)
6. Backend:
   - Updates deposit status
   - Credits KYAT to user balance

### Withdrawal Flow
1. User enters KYAT amount and TON address
2. Frontend sends POST /withdrawals
3. Backend:
   - Validates amount (min 5,000 KYAT)
   - Validates TON address
   - Deducts KYAT immediately
   - Creates withdrawal record
4. Admin processes withdrawal
5. Backend updates status with transaction hash

## Security Layers

1. **Authentication**: JWT tokens via Telegram WebApp
2. **Authorization**: Role-based (admin/user)
3. **Input Validation**: DTOs with class-validator
4. **SQL Injection**: TypeORM parameterized queries
5. **CORS**: Restricted to frontend domain
6. **Rate Limiting**: (Recommended for production)

## Key Design Decisions

### Off-Chain Lottery
- All lottery logic runs in database
- TON only used for deposits/withdrawals
- Faster and cheaper than on-chain
- Centralized but simpler

### Proportional Payouts
- Winners share 90% pool based on bet size
- Larger bets = larger share
- Fair distribution system

### Points System
- 10 points per bet
- Can be used for future features
- No leaderboard (as per requirements)

### Admin Fee
- 10% of total pool per round
- Collected automatically
- Can be withdrawn by admin

## Scalability Considerations

### Current Limitations
- Single database instance
- No caching layer
- No load balancing
- Manual TON transaction processing

### Future Improvements
- Redis for caching
- Database read replicas
- Queue system for withdrawals
- Automated TON transaction monitoring
- WebSocket for real-time updates

## Monitoring & Logging

### Recommended Metrics
- Active users per hour
- Total bets per round
- Average bet size
- Deposit/withdrawal volumes
- Lottery round completion rate
- API response times

### Logging
- All API requests
- Lottery draws
- Deposit/withdrawal events
- Error tracking

## Backup Strategy

### Database
- Daily automated backups
- Point-in-time recovery
- Backup retention: 30 days

### Critical Data
- User balances
- Bet history
- Lottery rounds
- Transaction records

