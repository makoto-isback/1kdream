# Lottery System Implementation

## Overview

Hourly lottery system with 25 blocks, proportional payouts, and transaction safety.

## Rules

- **25 Blocks**: Numbers 01-25
- **Minimum Bet**: 1,000 KYAT
- **Maximum Bet Per User Per Round**: 100,000 KYAT
- **Maximum Bets Per User Per Round**: 10 bets
- **Round Frequency**: Every hour
- **Admin Fee**: 10% of total pool
- **Winner Pool**: 90% of total pool
- **Payout**: Proportional to bet size
- **No-Winner Rule**: If no one bets on winning block, 90% refunded proportionally
- **Points**: Every 1,000 KYAT bet = 10 points

## Architecture

### Entities

1. **LotteryRound**
   - Tracks each hourly round
   - Stores pool amounts, winning block, status
   - Status: `pending`, `active`, `completed`

2. **Bet**
   - User bets on specific blocks (1-25)
   - Links to user and lottery round
   - Stores bet amount and payout (if won)

3. **User**
   - Updated with KYAT balance and points
   - Relationship to bets

### Services

1. **LotteryService**
   - Manages lottery rounds
   - Handles drawing winners
   - Calculates payouts proportionally

2. **BetsService**
   - Places bets with transaction safety
   - Validates bet amounts and blocks
   - Awards points

3. **HourlyDrawJob**
   - Cron job runs every hour
   - Triggers lottery draw when time is reached

## Database Transactions

All critical operations use database transactions with pessimistic locking:

1. **Placing a Bet**
   - Locks user row to prevent race conditions
   - Deducts balance atomically
   - Adds points
   - Creates bet record
   - Updates lottery pool

2. **Drawing Winners**
   - Locks lottery round row
   - Locks user rows when distributing payouts
   - Ensures atomic payout distribution
   - Rolls back on any error

## API Endpoints

### Bets

**POST** `/bets`
- Place a bet on a block
- Body: `{ blockNumber: 1-25, amount: >= 1000 }`
- Headers: `Authorization: Bearer <token>`
- Returns: Bet object

**GET** `/bets/my?limit=50`
- Get user's betting history
- Headers: `Authorization: Bearer <token>`

### Lottery

**GET** `/lottery/active`
- Get current active round
- Returns: LotteryRound with pool info

**GET** `/lottery/latest`
- Get most recent round (completed or active)

**GET** `/lottery/round/:id`
- Get specific round details
- Headers: `Authorization: Bearer <token>`

**GET** `/lottery/round/:id/stats`
- Get round statistics (bets per block)
- Headers: `Authorization: Bearer <token>`

## Flow

### Betting Flow

1. User selects block (1-25) and amount (>= 1000 KYAT)
2. System validates:
   - Block number (1-25)
   - Amount (minimum 1000)
   - User balance
3. Transaction starts:
   - Lock user row
   - Check max bet limits (100K per round, 10 bets per round)
   - Deduct balance
   - Add points (1,000 KYAT = 10 points)
   - Create bet record
   - Update lottery pool (10% admin, 90% winner)
4. Transaction commits

### Lottery Draw Flow

1. Cron job runs every hour
2. Checks for active round
3. If draw time reached:
   - Start transaction
   - Lock round row
   - Generate random winning block (1-25)
   - Find all winning bets
   - If winners exist:
     - Calculate proportional payouts
     - Distribute payouts (lock user rows)
   - If no winners:
     - Refund 90% proportionally to all users
     - Admin keeps 10%
   - Mark round as completed
   - Commit transaction
   - Create new round for next hour (if not paused)

### Payout Calculation

#### Winning Round
```
For each winning bet:
  proportion = bet.amount / totalWinningBetAmount
  payout = round.winnerPool * proportion
```

Example:
- Winner pool: 90,000 KYAT
- User A bet: 5,000 KYAT on winning block
- User B bet: 10,000 KYAT on winning block
- Total winning bets: 15,000 KYAT
- User A payout: 90,000 * (5,000 / 15,000) = 30,000 KYAT
- User B payout: 90,000 * (10,000 / 15,000) = 60,000 KYAT

#### No-Winner Round (Refund)
```
For each bet:
  proportion = bet.amount / totalBets
  refund = refundPool * proportion
```

Example:
- Total pool: 50,000 KYAT
- Refund pool: 45,000 KYAT (90%)
- User A bet: 10,000 KYAT
- User B bet: 40,000 KYAT
- Total bets: 50,000 KYAT
- User A refund: 45,000 * (10,000 / 50,000) = 9,000 KYAT
- User B refund: 45,000 * (40,000 / 50,000) = 36,000 KYAT

## Safety Features

1. **Pessimistic Locking**: Prevents race conditions
2. **Database Transactions**: Ensures atomicity
3. **Balance Validation**: Checks before deducting
4. **Error Handling**: Rolls back on failures
5. **Idempotency**: Can safely retry operations

## Testing

### Manual Test Flow

1. Create user and authenticate
2. Deposit KYAT (via admin or direct DB)
3. Place bet: `POST /bets { blockNumber: 5, amount: 5000 }`
4. Check balance deducted and points added
5. Wait for hourly draw or trigger manually
6. Verify winners received payouts

### Trigger Manual Draw

```typescript
// In lottery service, call:
await lotteryService.drawWinner(roundId);
```

## Monitoring

- Check cron job logs: `HourlyDrawJob` logs
- Monitor transaction errors
- Track pool sizes
- Verify payout accuracy

## Future Enhancements

- WebSocket for real-time updates
- Betting limits per user
- Historical statistics
- Admin dashboard

