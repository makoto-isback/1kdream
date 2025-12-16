# Real-Time Events Documentation

## Overview

The application uses **Socket.IO** for real-time, server-driven event notifications. This ensures instant, reliable delivery of critical events like round completion without polling or countdown dependencies.

## Architecture

### Backend (NestJS)

- **Gateway**: `src/gateways/events.gateway.ts`
  - WebSocket server on namespace `/events`
  - JWT authentication required for all connections
  - Broadcasts events to all connected clients

### Frontend (React)

- **Service**: `src/services/socket.ts`
  - Singleton Socket.IO client
  - Automatic reconnection with exponential backoff
  - Connection managed by `AuthContext`

## Event Flow

### Round Completion Flow

```
1. Backend cron job triggers round draw
   └─> lottery.service.ts:drawWinner()

2. Transaction commits successfully
   └─> Database updated (round status, winning block, payouts)

3. IMMEDIATELY after commit:
   └─> eventsGateway.emitRoundCompleted()
       └─> Broadcasts 'round:completed' event to ALL connected clients

4. Frontend receives event
   └─> LotteryPage.tsx: socketService.onRoundCompleted()
       └─> Fetches round stats (for winners count)
       └─> Triggers WinningPopup instantly
```

## Events

### `round:completed`

**Emitted by**: Backend (`EventsGateway`)  
**Triggered**: Immediately after round completion transaction commits  
**Payload**:

```typescript
{
  roundId: string;
  roundNumber: number;
  winningBlock: number;
  status: 'completed';
  totalPool: number;
  winnerPool: number;
  drawnAt: string; // ISO date string
  timestamp: string; // ISO date string
}
```

**Guarantees**:
- ✅ Emitted EXACTLY ONCE per round
- ✅ Only after successful DB transaction commit
- ✅ Delivered to ALL connected clients
- ✅ Survives slow networks (Socket.IO handles retries)

## Connection Management

### Authentication

All Socket.IO connections require JWT authentication:

```typescript
// Client connects with token
socket.connect({
  auth: { token: 'jwt-token-here' }
});

// Server verifies token on connection
// Disconnects if invalid
```

### Lifecycle

1. **Connect**: On user login (via `AuthContext`)
2. **Reconnect**: Automatic with exponential backoff (max 5 attempts)
3. **Disconnect**: On user logout or app unmount

### Connection States

- `connected`: Authenticated and ready to receive events
- `disconnected`: Not connected (will auto-reconnect)
- `connect_error`: Authentication failed or network error

## Implementation Details

### Backend: Event Emission

```typescript
// In lottery.service.ts:drawWinner()
await queryRunner.commitTransaction();

// Emit IMMEDIATELY after commit
if (this.eventsGateway && round.winningBlock) {
  this.eventsGateway.emitRoundCompleted({
    roundId: round.id,
    roundNumber: round.roundNumber,
    winningBlock: round.winningBlock,
    // ... other fields
  });
}
```

**Critical**: Event is emitted AFTER transaction commit, ensuring data consistency.

### Frontend: Event Handling

```typescript
// In LotteryPage.tsx
useEffect(() => {
  const unsubscribe = socketService.onRoundCompleted((event) => {
    // Only show popup once per round
    if (popupShownRef.current !== event.roundId) {
      // Fetch additional data (winners count)
      // Show popup instantly
      setShowWinningPopup(true);
      popupShownRef.current = event.roundId;
    }
  });

  return () => unsubscribe();
}, []);
```

**Critical**: Uses `popupShownRef` to ensure popup shows EXACTLY ONCE per round.

## Benefits Over Polling

| Aspect | Polling | Socket.IO |
|--------|---------|-----------|
| **Latency** | 1-5 seconds delay | Instant (<100ms) |
| **Network** | Constant requests | Single persistent connection |
| **Reliability** | Can miss events | Guaranteed delivery |
| **Scalability** | High server load | Low overhead |
| **Battery** | Drains device battery | Efficient |

## Error Handling

### Backend

- Invalid token → Disconnect client
- Connection error → Logged, client can reconnect
- Event emission failure → Logged, does not affect round completion

### Frontend

- Connection lost → Auto-reconnect (max 5 attempts)
- Event received but stats fetch fails → Popup still shows with event data
- Socket not connected → Falls back gracefully (no popup, but no crash)

## Testing

### Manual Test Flow

1. Start backend and frontend
2. Login to frontend (Socket.IO connects automatically)
3. Wait for round to complete (or trigger manually via admin)
4. Verify popup appears INSTANTLY (<1 second)
5. Verify popup shows correct winning number
6. Verify popup shows only once per round

### Debugging

**Backend logs**:
```
[EventsGateway] Client abc123 connected (User: user-id)
[EventsGateway] Emitting round:completed for round #42
```

**Frontend console**:
```
[Socket] Connected: abc123
[Socket] Authenticated as user: user-id
[Socket] Subscribing to round:completed
[LotteryPage] Received round:completed event: {...}
```

## Production Considerations

1. **CORS**: Configure `FRONTEND_URL` environment variable
2. **JWT Secret**: Use strong secret in production
3. **Rate Limiting**: Consider rate limiting for Socket.IO connections
4. **Monitoring**: Monitor connection count and event emission rate
5. **Scaling**: Socket.IO supports Redis adapter for horizontal scaling

## Future Enhancements

- [ ] Add `bet:placed` event for real-time pool updates
- [ ] Add `balance:updated` event for instant balance refresh
- [ ] Add `autobet:executed` event for plan status updates
- [ ] Implement Redis adapter for multi-server deployments

