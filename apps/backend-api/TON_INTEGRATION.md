# TON USDT Integration

## Overview

TON blockchain integration for USDT deposits and withdrawals with automatic detection and admin approval flow.

## Features

### Deposit Detection
- **Automatic Monitoring**: Checks for USDT Jetton transfers every 30 seconds
- **Transaction Verification**: Validates transactions on TON blockchain
- **Duplicate Prevention**: Prevents processing same transaction twice
- **Admin Approval**: Requires admin confirmation before crediting balance

### Withdrawal System
- **Request Creation**: Users create withdrawal requests
- **Balance Lock**: Balance deducted immediately on request
- **Admin Approval**: Admin reviews and processes withdrawals
- **TON Execution**: Sends USDT via TON blockchain
- **Refund Safety**: Rejected withdrawals refund balance

## Exchange Rate

- **1 USD = 5,000 KYAT**
- **1 USDT = 5,000 KYAT**

## Limits

- **Minimum Deposit**: 1,000 KYAT (0.2 USDT)
- **Minimum Withdrawal**: 5,000 KYAT (1 USDT)

## Configuration

### Environment Variables

```env
TON_WALLET_ADDRESS=your-ton-wallet-address
TON_NETWORK=mainnet
TON_API_URL=https://tonapi.io/v2
TON_API_KEY=your-ton-api-key
```

### TON API Setup

1. Get API key from [TON API](https://tonapi.io/)
2. Configure wallet address (where deposits are received)
3. Set network (mainnet/testnet)

## Deposit Flow

1. **User sends USDT** to configured wallet address
2. **Listener detects** transfer (every 30 seconds)
3. **System creates** pending deposit record
4. **Admin confirms** deposit with transaction hash
5. **Balance credited** to user account

### Manual Deposit Confirmation

Admin can manually confirm deposits:

```http
POST /admin/deposits/:id/confirm
{
  "tonTxHash": "transaction-hash"
}
```

## Withdrawal Flow

1. **User requests** withdrawal with KYAT amount and TON address
2. **Balance deducted** immediately (locked)
3. **Admin reviews** pending withdrawals
4. **Admin executes** withdrawal (sends USDT)
5. **Status updated** to completed with transaction hash

### Admin Endpoints

**Get Pending Withdrawals:**
```http
GET /admin/withdrawals/pending
```

**Execute Withdrawal:**
```http
POST /admin/withdrawals/:id/execute
```

**Process Withdrawal (Manual):**
```http
POST /admin/withdrawals/:id/process
{
  "tonTxHash": "transaction-hash"
}
```

**Reject Withdrawal:**
```http
POST /admin/withdrawals/:id/reject
```

## Database Entities

### Deposit
- `usdtAmount`: Amount in USDT
- `kyatAmount`: Converted amount (usdtAmount * 5000)
- `tonTxHash`: Transaction hash
- `status`: pending/confirmed/failed

### Withdrawal
- `kyatAmount`: Amount in KYAT
- `usdtAmount`: Converted amount (kyatAmount / 5000)
- `tonAddress`: Recipient TON address
- `tonTxHash`: Transaction hash (after processing)
- `status`: pending/processing/completed/rejected

## Safety Features

1. **Transaction Safety**: All balance operations use database transactions
2. **Pessimistic Locking**: Prevents race conditions
3. **Duplicate Prevention**: Checks for existing transactions
4. **Refund on Reject**: Rejected withdrawals refund balance
5. **Status Tracking**: Full audit trail of all operations

## USDT Jetton Details

- **Master Address**: `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs` (mainnet)
- **Decimals**: 6
- **Standard**: Jetton (TON token standard)

## Production Considerations

1. **Wallet Security**: Use hardware wallet or secure key management
2. **API Rate Limits**: Monitor TON API usage
3. **Transaction Fees**: Account for TON gas fees
4. **Monitoring**: Set up alerts for failed transactions
5. **Backup**: Regular database backups
6. **User Address Linking**: Consider linking user Telegram IDs to TON addresses

## Testing

### Test Deposit Flow

1. Send test USDT to wallet address
2. Wait for listener to detect (max 30 seconds)
3. Check admin panel for pending deposit
4. Confirm deposit with transaction hash
5. Verify user balance updated

### Test Withdrawal Flow

1. User creates withdrawal request
2. Verify balance deducted
3. Admin reviews in pending list
4. Admin executes withdrawal
5. Verify status updated
6. Check TON blockchain for transaction

## Future Enhancements

- Automatic user address matching
- Webhook notifications
- Multi-signature wallet support
- Transaction fee estimation
- Batch withdrawal processing

