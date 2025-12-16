# ADream - Final Business Rules (LOCKED)

**Version:** 1.0  
**Status:** LOCKED - Phase 3 Complete  
**Date:** 2024

---

## GLOBAL BUSINESS RULES

### Currency & Exchange Rates

- **In-game Currency:** KYAT (off-chain only)
- **Exchange Rate:** 1 USDT = 5,000 KYAT
- **Blockchain:** TON (USDT Jetton only)

---

## LOTTERY RULES

### General Rules

- **Blocks:** 25 blocks (01-25)
- **Frequency:** One round every 1 hour
- **Winning Block:** Exactly 1 winning block per round (random)
- **Admin Fee:** 10% of total pool
- **Winner Pool:** 90% of total pool

### Betting Limits

- **Minimum Bet:** 1,000 KYAT
- **Maximum Bet Per User Per Round:** 100,000 KYAT
- **Maximum Bets Per User Per Round:** 10 bets
- **Maximum Total Per Round:** Unlimited (sum of all user bets)

### No-Winner Rule

**If no one bets on the winning block:**

- Admin keeps 10% of total pool
- 90% of total bets are refunded proportionally to all users
- Refund formula: `(userBet / totalBets) * refundPool`

### Payout Logic

#### Winning Round

**Formula:**
```
userPayout = (userBetOnWinningBlock / totalBetsOnWinningBlock) * winnerPool
```

**Example:**
- Total pool: 100,000 KYAT
- Admin fee: 10,000 KYAT
- Winner pool: 90,000 KYAT
- User A bet: 5,000 KYAT on block 5 (winning)
- User B bet: 10,000 KYAT on block 5 (winning)
- Total winning bets: 15,000 KYAT
- User A payout: 90,000 × (5,000 / 15,000) = 30,000 KYAT
- User B payout: 90,000 × (10,000 / 15,000) = 60,000 KYAT

#### Refund Round

**Formula:**
```
refundAmount = (userBet / totalBets) * refundPool
```

**Example:**
- Total pool: 50,000 KYAT
- Refund pool: 45,000 KYAT (90%)
- User A bet: 10,000 KYAT
- User B bet: 40,000 KYAT
- Total bets: 50,000 KYAT
- User A refund: 45,000 × (10,000 / 50,000) = 9,000 KYAT
- User B refund: 45,000 × (40,000 / 50,000) = 36,000 KYAT

---

## AUTO-BET (PREPAID BETTING)

### Rules

- User selects 1-25 blocks
- Sets bet amount per block
- Sets number of rounds (e.g., 24 rounds)
- Total amount is prepaid and locked
- System places bets automatically each round

### AutoBet Stops If

- Balance insufficient
- Rounds completed
- User cancels

### Constraints

- Must obey max 100K KYAT per round
- Must obey max 10 bets per round
- Total per round = `blocks.length × betAmountPerBlock`

### Refund on Cancel

- Formula: `(roundsRemaining / totalRounds) × totalLockedAmount`
- Refunded to user balance immediately

---

## POINTS SYSTEM

### Earning Points

- **Rate:** Every 1,000 KYAT bet = 10 points
- **Formula:** `pointsEarned = floor(amount / 1000) × 10`

**Examples:**
- 1,000 KYAT bet = 10 points
- 5,000 KYAT bet = 50 points
- 10,000 KYAT bet = 100 points

### Redemption

- **Rate:** 1,000 points = 1,000 KYAT (1:1 ratio)
- **Minimum Redeem:** 10,000 points
- **Process:** Points redeemed into KYAT balance
- **Record:** All redemptions logged

**Example:**
- User has 15,000 points
- Redeems 12,000 points
- Receives 12,000 KYAT
- Remaining: 3,000 points

---

## DEPOSITS (TON USDT)

### Wallet Model

- Single hot wallet
- Detect USDT Jetton transfers
- Identify deposits by:
  - Sender TON address
  - Amount
  - TX hash

### User Flow

1. **User must register TON address** before direct deposit
2. Deposits from registered addresses:
   - Auto-detected (every 30 seconds)
   - Status: `pending` → `confirmed` (admin approval)
3. Deposits from unknown addresses:
   - Status: `pending_manual`
   - Require admin review
   - Admin matches to user and confirms

### Limits

- **Minimum Deposit:** 1,000 KYAT (0.2 USDT)

### Status Flow

- `pending` - Awaiting confirmation
- `pending_manual` - Unknown sender, needs admin review
- `confirmed` - Approved and credited
- `failed` - Transaction failed

---

## WITHDRAWALS

### Rules

- **Minimum:** 5,000 KYAT (1 USDT)
- **Daily Max Per User:** 500,000 KYAT
- **Withdrawal Delay:** 1 hour (from request time)
- **Status Flow:** `pending` → `processing` → `completed` / `rejected`

### Process

1. User creates withdrawal request
2. Balance deducted immediately (locked)
3. 1-hour delay enforced
4. Admin processes after delay
5. USDT sent via TON blockchain
6. Status updated to `completed`

### Manual Withdraw (Support)

- Admin can manually debit KYAT
- Admin manually sends USDT
- All actions logged

### Refund on Reject

- If withdrawal rejected, balance refunded
- Transaction rolled back

---

## ADMIN & SAFETY CONTROLS

### Emergency Switches

**System Settings:**
- `withdrawalsPaused` - Pause all withdrawals
- `bettingPaused` - Pause all betting
- `newRoundsPaused` - Pause new round creation

### Manual Balance Adjustment

**Endpoint:** `POST /admin/manual-adjust`

**Body:**
```json
{
  "userId": "uuid",
  "amount": 10000,
  "type": "credit" | "debit",
  "reason": "Support adjustment"
}
```

**Safety:**
- All adjustments logged
- Transaction-safe
- Requires admin authentication

---

## REAL-TIME FEATURES

### Latest Winners Feed

**Endpoint:** `GET /lottery/winners-feed`

**Response:**
```json
[
  {
    "roundNumber": 123,
    "block": 5,
    "username": "us***r",
    "payout": 30000,
    "drawnAt": "2024-01-01T12:00:00Z"
  }
]
```

### Round Pool Info

**Endpoint:** `GET /lottery/pool-info`

**Response:**
```json
{
  "activeRound": {
    "roundNumber": 124,
    "totalPool": 50000,
    "winnerPool": 45000,
    "adminFee": 5000,
    "totalBets": 25,
    "drawTime": "2024-01-01T13:00:00Z"
  },
  "latestRound": {
    "roundNumber": 123,
    "winningBlock": 5,
    "totalPool": 40000,
    "status": "completed",
    "drawnAt": "2024-01-01T12:00:00Z"
  }
}
```

---

## INTERNATIONALIZATION

### Supported Languages

- **Burmese (my)** - Default
- **English (en)**

### Backend Support

- Translation keys available via `I18nService`
- Frontend will handle language switching
- All error messages support both languages

---

## DATABASE ENTITIES

### Core Entities

1. **User**
   - `telegramId` (unique)
   - `kyatBalance`
   - `points`
   - `tonAddress` (nullable)

2. **LotteryRound**
   - `roundNumber` (unique)
   - `winningBlock` (1-25, nullable)
   - `totalPool`, `adminFee`, `winnerPool`
   - `status` (pending/active/completed)
   - `drawTime`, `drawnAt`

3. **Bet**
   - `blockNumber` (1-25)
   - `amount` (KYAT)
   - `payout` (nullable)
   - `isWinner` (boolean)

4. **Deposit**
   - `usdtAmount`, `kyatAmount`
   - `tonTxHash`
   - `senderTonAddress`
   - `status` (pending/pending_manual/confirmed/failed)

5. **Withdrawal**
   - `kyatAmount`, `usdtAmount`
   - `tonAddress`
   - `tonTxHash`
   - `requestTime` (for 1-hour delay)
   - `status` (pending/processing/completed/rejected)

### New Entities

6. **AutoBetPlan**
   - `blocks` (array 1-25)
   - `betAmountPerBlock`
   - `roundsRemaining`, `totalRounds`
   - `totalLockedAmount`
   - `status` (active/paused/completed/cancelled)

7. **PointsRedemption**
   - `pointsUsed`
   - `kyatGranted`
   - `createdAt`

8. **SystemSettings**
   - `withdrawalsPaused`
   - `bettingPaused`
   - `newRoundsPaused`

---

## TRANSACTION SAFETY

### All Critical Operations Use:

1. **Database Transactions**
   - Atomic operations
   - Rollback on errors

2. **Pessimistic Locking**
   - User rows locked during balance operations
   - Round rows locked during draws
   - Prevents race conditions

3. **Validation**
   - Input validation (DTOs)
   - Business rule validation
   - Balance checks

4. **Error Handling**
   - Comprehensive error messages
   - Transaction rollback
   - Logging

---

## API ENDPOINTS SUMMARY

### Authentication
- `POST /auth/telegram` - Login
- `GET /auth/check` - Check auth

### Users
- `GET /users/me` - Get profile
- `POST /users/ton-address` - Register TON address

### Bets
- `POST /bets` - Place bet
- `GET /bets/my` - Betting history

### Lottery
- `GET /lottery/active` - Active round
- `GET /lottery/latest` - Latest round
- `GET /lottery/winners-feed` - Winners feed
- `GET /lottery/pool-info` - Pool information

### AutoBet
- `POST /autobet` - Create plan
- `POST /autobet/:id/cancel` - Cancel plan
- `GET /autobet/my` - User plans

### Points
- `POST /points/redeem` - Redeem points
- `GET /points/redemptions` - Redemption history

### Deposits
- `POST /deposits` - Create deposit request
- `GET /deposits/address` - Get wallet address
- `GET /deposits/my` - User deposits

### Withdrawals
- `POST /withdrawals` - Create withdrawal
- `GET /withdrawals/my` - User withdrawals

### Admin
- `GET /admin/stats` - System statistics
- `GET /admin/deposits` - All deposits
- `POST /admin/deposits/:id/confirm` - Confirm deposit
- `GET /admin/withdrawals/pending` - Pending withdrawals
- `POST /admin/withdrawals/:id/execute` - Execute withdrawal
- `POST /admin/withdrawals/:id/reject` - Reject withdrawal
- `POST /admin/manual-adjust` - Manual balance adjustment
- `POST /admin/system-settings` - Update system settings

---

## NOTES

- All amounts in KYAT are stored as decimals (precision 18, scale 2)
- All USDT amounts stored as decimals (precision 18, scale 8)
- All timestamps in UTC
- All transactions are logged
- System is production-ready with comprehensive error handling

---

**END OF DOCUMENT**

