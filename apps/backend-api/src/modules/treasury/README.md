# Treasury-Based Deposit & Withdraw System

## Overview

This is an **additive, isolated** treasury-based deposit and withdraw system that does NOT modify existing lottery logic. All new functionality is completely separate from the existing lottery system.

## Architecture

- **Treasury Wallet**: Single TON/USDT wallet address for all deposits
- **Memo-Based Indexing**: Transactions identified by memo format
- **Backend Workers**: Automated processing via cron jobs
- **Admin Dashboard**: Manual oversight and monitoring
- **No Smart Contracts**: Pure on-chain transactions

## Database Schema

### New Tables (Isolated)

1. **treasury_transactions**
   - Raw transaction log from blockchain
   - Idempotent (tx_hash unique)

2. **user_deposits**
   - Deposit records linked to users
   - Status: PENDING → CONFIRMED

3. **withdraw_requests**
   - Withdrawal requests with 1-hour delay
   - Status: PENDING → COMPLETED/REJECTED

4. **withdraw_limits_daily**
   - Daily withdrawal limits per user
   - Enforces 5,000,000 KYAT/day maximum

## Memo Formats

### Deposit
```
deposit:<userId>
```

### Withdraw Request
```
withdraw:<userId>:<kyatAmount>:<destinationAddress>
```

## Workers

### 1. Treasury Indexer (`TreasuryIndexerWorker`)
- **Schedule**: Every 30 seconds
- **Purpose**: Polls TON blockchain for treasury wallet transactions
- **Enabled**: `TREASURY_INDEXER_ENABLED=true`
- **Behavior**:
  - Indexes all TON/USDT transactions to treasury
  - Parses memos
  - Creates deposit/withdraw request records

### 2. Deposit Confirmation (`DepositConfirmationWorker`)
- **Schedule**: Every 2 minutes
- **Purpose**: Auto-confirms deposits after 3 block confirmations
- **Enabled**: `DEPOSIT_CONFIRMATION_ENABLED=true`
- **Behavior**:
  - Checks confirmation count
  - Credits user balance when confirmed
  - Isolated from lottery logic

### 3. Withdraw Executor (`WithdrawExecutorWorker`)
- **Schedule**: Every minute
- **Purpose**: Executes pending withdrawals after 1-hour delay
- **Enabled**: `WITHDRAW_EXECUTOR_ENABLED=true`
- **Behavior**:
  - Finds requests where `executeAfter <= now`
  - Validates daily limits
  - Checks user balance
  - Sends USDT payout
  - Records treasury OUT transaction

### 4. Daily Summary (`DailySummaryJob`)
- **Schedule**: Daily at 00:00 UTC
- **Purpose**: Generate daily reports and alerts
- **Behavior**:
  - Summarizes deposits/withdrawals
  - Calculates net flow
  - Alerts on anomalies

## Environment Variables

```bash
# Enable workers
TREASURY_INDEXER_ENABLED=true
DEPOSIT_CONFIRMATION_ENABLED=true
WITHDRAW_EXECUTOR_ENABLED=true

# Treasury addresses (already configured in constants)
TON_TREASURY_ADDRESS=UQD5OzR2XJRSTDBEnK4W8OD8Ed04jVkHOPI5wdwOkZTB4Y38
USDT_TREASURY_ADDRESS=UQD5OzR2XJRSTDBEnK4W8OD8Ed04jVkHOPI5wdwOkZTB4Y38
```

## Admin Endpoints

All endpoints require `JwtAuthGuard` + `AdminGuard`.

### Withdraw Management
- `GET /treasury/withdraws/pending` - List pending withdrawals
- `POST /treasury/withdraws/:id/approve` - Approve (execute immediately)
- `POST /treasury/withdraws/:id/reject` - Reject withdrawal

### Treasury Overview
- `GET /treasury/overview` - Dashboard summary
- `GET /treasury/risk-indicators` - Risk analysis

### Deposit Management
- `POST /treasury/deposits/:id/confirm` - Manually confirm deposit

## Withdraw Limits

- **Minimum**: 10,000 KYAT
- **Maximum**: 5,000,000 KYAT per day
- **Fee**: 0.1 TON (request fee)
- **Delay**: 1 hour (configurable via `WITHDRAW_DELAY_HOURS`)

## Safety Features

1. **Idempotency**: All operations check for duplicates
2. **Isolation**: No modification to lottery tables/logic
3. **Retry-Safe**: Workers handle errors gracefully
4. **Crash-Safe**: Database transactions ensure consistency
5. **Kill Switch**: Workers can be disabled via env vars

## Flow Diagrams

### Deposit Flow
```
User sends TON/USDT → Treasury Wallet
  ↓
Memo: deposit:<userId>
  ↓
Treasury Indexer detects → Creates user_deposit (PENDING)
  ↓
Deposit Confirmation Worker → Checks confirmations (3 blocks)
  ↓
Auto-confirms → Credits user.kyatBalance
```

### Withdraw Flow
```
User sends 0.1 TON fee → Treasury Wallet
  ↓
Memo: withdraw:<userId>:<kyatAmount>:<address>
  ↓
Treasury Indexer detects → Creates withdraw_request (PENDING)
  ↓
executeAfter = now + 1 hour
  ↓
Withdraw Executor Worker → Validates & executes
  ↓
Sends USDT payout → Marks COMPLETED
```

## Important Notes

- **Existing lottery system is untouched**
- **User balance is shared** (deposits credit, withdrawals deduct)
- **No breaking changes** to existing APIs
- **All new logic is additive**
- **Production-safe** with proper error handling

