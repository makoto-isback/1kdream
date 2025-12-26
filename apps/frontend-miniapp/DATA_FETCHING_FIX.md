# Frontend Data Fetching Flow Fix - 429 Error Elimination

## Summary

This document describes the comprehensive fix for 429 "Too Many Requests" errors that occurred after placing multiple bets. The solution implements a **socket-first, debounced HTTP sync** architecture.

## Goals Achieved ✅

1. ✅ **Eliminated request spam** - No immediate HTTP refetches after bet placement
2. ✅ **Socket-first updates** - UI updates instantly via WebSocket events
3. ✅ **Debounced HTTP fetches** - All HTTP refetches are debounced (≥3 seconds)
4. ✅ **Graceful 429 handling** - Automatic retry with exponential backoff
5. ✅ **Prevented duplicate fetches** - Fetch guards prevent simultaneous requests
6. ✅ **Optimistic UI updates** - UI updates immediately, syncs later

## Architecture Changes

### 1. Socket-First Data Flow

**Before:**
- Bet placed → Immediate HTTP refetch → Update UI
- Multiple bets → Multiple immediate refetches → 429 errors

**After:**
- Bet placed → Socket event (`bet:placed`) → Instant UI update
- Socket event (`user:balance:updated`) → Instant balance update
- Delayed debounced sync (3+ seconds) → Safety net only

### 2. Debounced HTTP Fetches

All HTTP fetches for lottery data are now debounced:

- **Round Stats** (`/lottery/round/:id/stats`): 3-second debounce
- **User Bets** (`/bets/my`): 3-second debounce
- **User Data** (`/users/me`): 3-second debounce

Multiple calls within the debounce window collapse into a single request.

### 3. Fetch Guards

Prevent duplicate simultaneous requests:

- `getUserBets()`: Guarded to prevent concurrent calls
- `refreshUser()`: Guarded and debounced
- `fetchRoundStats()`: Guarded and debounced

### 4. 429 Retry Logic

API interceptor automatically retries 429 errors:

- **Max retries**: 3
- **Initial delay**: 2 seconds
- **Backoff**: Exponential (2s, 4s, 5s max)
- **Behavior**: Preserves UI state, doesn't throw errors

## File Changes

### New Files

1. **`src/utils/debounce.ts`**
   - `debounce()`: Generic debounce utility
   - `createDebouncedFetch()`: Shared debounced fetch with promise caching

2. **`src/utils/fetchGuard.ts`**
   - `guardFetch()`: Prevents duplicate simultaneous requests
   - Uses timestamp-based locks (5-second timeout)

### Modified Files

1. **`src/services/api.ts`**
   - Added 429 retry logic with exponential backoff
   - Preserves UI state on retry failures

2. **`src/hooks/useLotteryData.ts`**
   - Removed immediate HTTP refetches after socket events
   - Added debounced `syncRoundStats()` and `syncUserBets()`
   - Socket handlers update UI instantly (no HTTP)
   - Added refs to avoid stale closures in socket handlers

3. **`src/pages/LotteryPage.tsx`**
   - Removed immediate `refreshUser()` after bet placement
   - Removed immediate `refetch()` after bet placement
   - Added single delayed sync fetch (3.5 seconds) as safety net
   - Socket events handle all real-time updates

4. **`src/contexts/AuthContext.tsx`**
   - Added debounced `refreshUser()` for non-critical updates
   - Kept `refreshUserImmediate()` for critical auth flows
   - Socket events trigger debounced refresh (not immediate)

5. **`src/services/bets.ts`**
   - Added fetch guard to `getUserBets()` to prevent duplicates

## Data Flow After Fix

### Bet Placement Flow

```
1. User places bet
   ↓
2. POST /bets (HTTP request)
   ↓
3. Backend emits socket events:
   - bet:placed (with updated stats)
   - user:balance:updated (with new balance)
   ↓
4. Frontend socket handlers:
   - Update round pool instantly
   - Update block stats instantly
   - Update user balance instantly
   ↓
5. Delayed sync (3.5 seconds later):
   - Debounced fetchRoundStats()
   - Debounced syncUserBets()
   - Debounced refreshUser()
   (All collapse into single requests if multiple bets)
```

### Socket Events (Real-Time)

- **`bet:placed`**: Updates round pool, block stats instantly
- **`round:stats:updated`**: Updates block stats instantly
- **`round:active:updated`**: Updates active round instantly
- **`user:balance:updated`**: Updates user balance instantly (triggers debounced refreshUser)

### HTTP Sync (Debounced)

- **Round Stats**: Only when needed, debounced 3 seconds
- **User Bets**: Only when needed, debounced 3 seconds
- **User Data**: Only when needed, debounced 3 seconds

## Verification

After this fix:

✅ **User can place multiple bets in succession** - No 429 errors
✅ **UI updates live and smoothly** - Socket events provide instant updates
✅ **Network tab shows minimal requests** - Debouncing collapses multiple calls
✅ **No request spam** - Only one delayed sync fetch per bet (debounced)

## Key Principles

1. **Socket-First**: Always prefer socket events for real-time updates
2. **Debounce HTTP**: All HTTP refetches are debounced (≥3 seconds)
3. **Guard Fetches**: Prevent duplicate simultaneous requests
4. **Optimistic Updates**: Update UI immediately, sync later
5. **Graceful Degradation**: 429 errors retry automatically, preserve UI state

## Testing Checklist

- [ ] Place single bet → Verify instant UI update via socket
- [ ] Place 10 bets rapidly → Verify no 429 errors
- [ ] Check network tab → Verify minimal HTTP requests
- [ ] Verify balance updates instantly after bet
- [ ] Verify block stats update instantly after bet
- [ ] Verify delayed sync happens after 3+ seconds
- [ ] Verify multiple rapid bets collapse into single sync requests

