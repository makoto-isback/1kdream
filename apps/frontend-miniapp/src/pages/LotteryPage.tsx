import React, { useState, useEffect, useRef, useMemo } from 'react';
import { NumberGrid } from '../components/NumberGrid';
import { RoundPanel } from '../components/RoundPanel';
import { PurchaseControl } from '../components/PurchaseControl';
import { LanguageToggle } from '../components/LanguageToggle';
import { PointsModal } from '../components/PointsModal';
import { WalletModal } from '../components/WalletModal';
import { Icons } from '../components/Icons';
import { Language, PurchaseMode, NumberStats } from '../types/ui';
import { TonAddressModal } from '../components/TonAddressModal';
import { TRANSLATIONS } from '../constants/translations';
import { useAuth } from '../contexts/AuthContext';
import { useLotteryData } from '../hooks/useLotteryData';
import { useCountdown } from '../hooks/useCountdown';
import { betsService } from '../services/bets';
import { autobetService } from '../services/autobet';
import { validateBuy, validateAutoBuy } from '../utils/validation';
import { AutoBuyPlans } from '../components/AutoBuyPlans';
import { WinningHistoryBar, WinnerRound } from '../components/WinningHistoryBar';
import { WinningPopup } from '../components/WinningPopup';
import { LotteryRound, lotteryService, Winner } from '../services/lottery';
import { UserRoundHistory } from '../components/UserRoundHistory';
import { MyBetsThisRound } from '../components/MyBetsThisRound';
import AdminPanel from '../components/AdminPanel';
import { HowItWorksModal } from '../components/HowItWorksModal';
import api from '../services/api';
import { socketService, RoundCompletedEvent, UserBalanceUpdatedEvent } from '../services/socket';

/**
 * INVARIANT: This block grid must NEVER depend on backend, auth, wallet, or loading state.
 * Blocks 1–25 are static UI and must always render instantly.
 * 
 * This constant ensures blocks exist before any API calls, authentication, or async operations.
 * Stats (buyers, totalKyat) are optional overlays that update when API responds, but blocks
 * themselves must render immediately on page load regardless of any external state.
 */
const STATIC_BLOCKS: NumberStats[] = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  buyers: 0,
  totalKyat: 0,
  isSelected: false,
  isDisabled: false,
}));

const LotteryPage: React.FC = () => {
  const { user, refreshUser, isAuthReady } = useAuth();
  const { activeRound, blockStats, userStake, loading: dataLoading, error: dataError, refetch } = useLotteryData();
  const [language, setLanguage] = useState<Language>('en');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  // Merge static blocks with API stats (stats are optional overlays)
  const numbersState = useMemo(() => {
    return STATIC_BLOCKS.map(block => {
      const stats = blockStats?.get(block.id);
      return {
        ...block,
        buyers: stats?.buyers || 0,
        totalKyat: stats?.totalKyat || 0,
        isSelected: selectedIds.includes(block.id),
      };
    });
  }, [blockStats, selectedIds]);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isPointsOpen, setIsPointsOpen] = useState(false);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [showTonAddressModal, setShowTonAddressModal] = useState(false);
  const [autoBuyRefreshKey, setAutoBuyRefreshKey] = useState(0);
  const [showWinningPopup, setShowWinningPopup] = useState(false);
  const [completedRound, setCompletedRound] = useState<LotteryRound | null>(null);
  const shownRoundsRef = useRef<Set<string>>(new Set());
  const [winningBlockOverride, setWinningBlockOverride] = useState<number | null>(null);
  const [winnersCount, setWinnersCount] = useState<number | null>(null);
  const [winnersRefreshKey, setWinnersRefreshKey] = useState(0);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [hasActiveAutoBuy, setHasActiveAutoBuy] = useState(false);
  const [recentWinnersRounds, setRecentWinnersRounds] = useState<WinnerRound[]>([]);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [errorBannerVisible, setErrorBannerVisible] = useState(false);

  // Countdown is ONLY for display - no popup triggering logic
  const { countdown } = useCountdown(activeRound?.drawTime || null);

  // Auto-show error banner when error appears (only if no cached round)
  useEffect(() => {
    if (dataError && !activeRound) {
      setErrorBannerVisible(true);
      // Auto-dismiss after 10 seconds
      const timer = setTimeout(() => {
        setErrorBannerVisible(false);
      }, 10000);
      return () => clearTimeout(timer);
    } else if (!dataError || activeRound) {
      // Hide error banner when error clears or we have round data
      setErrorBannerVisible(false);
    }
  }, [dataError, activeRound]);

  // Load initial recent winners on mount (fallback if no socket events yet)
  useEffect(() => {
    const loadInitialWinners = async () => {
      try {
        const winners = await lotteryService.getWinnersFeed(20);
        if (winners && winners.length > 0) {
          // Aggregate by roundNumber
          const map = new Map<number, WinnerRound>();
          winners.forEach((w: Winner) => {
            const existing = map.get(w.roundNumber);
            if (existing) {
              existing.winnersCount += 1;
              if (!existing.winningBlock && w.block) existing.winningBlock = w.block;
            } else {
              map.set(w.roundNumber, {
                roundNumber: w.roundNumber,
                winningBlock: w.block,
                winnersCount: 1,
              });
            }
          });
          const rounds = Array.from(map.values())
            .sort((a, b) => b.roundNumber - a.roundNumber)
            .slice(0, 10);
          setRecentWinnersRounds(rounds);
        }
      } catch (error) {
        console.error('Error loading initial winners:', error);
      }
    };
    loadInitialWinners();
  }, []); // Only run once on mount

  // Load active auto-buy to restrict creating new ones
  // CRITICAL: Only call when authenticated to prevent 401 loops
  useEffect(() => {
    if (!isAuthReady || !user) return;
    
    const loadAuto = async () => {
      try {
        const plans = await autobetService.getUserPlans();
        const active = plans.some(p => p.status === 'active');
        setHasActiveAutoBuy(active);
      } catch (error: any) {
        // Don't retry on 401 - auth context will handle it
        if (error?.response?.status !== 401) {
          console.error('[LotteryPage] Error loading auto-buy plans:', error);
        }
      }
    };
    loadAuto();
  }, [autoBuyRefreshKey, isAuthReady, user]);

  // Listen for round:completed events via Socket.IO
  // This effect runs ONCE on mount and tracks shown rounds independently
  // Socket connection is managed by AuthContext - we only subscribe here
  useEffect(() => {
    // Subscribe to round:completed events
    // Socket connection is handled by AuthContext singleton
    const unsubscribe = socketService.onRoundCompleted((event: RoundCompletedEvent) => {
      console.log('🎰 [LotteryPage] ✅ RECEIVED round:completed event');
      console.log('🎰 [LotteryPage] Event details:', {
        roundId: event.roundId,
        roundNumber: event.roundNumber,
        winningBlock: event.winningBlock,
        status: event.status,
        timestamp: event.timestamp,
      });
      
      // Check if we've already shown popup for this round
      if (shownRoundsRef.current.has(event.roundId)) {
        console.log('🎰 [LotteryPage] ⚠️ Popup already shown for round:', event.roundId);
        console.log('🎰 [LotteryPage] Shown rounds Set:', Array.from(shownRoundsRef.current));
        return;
      }
      
      console.log('🎰 [LotteryPage] 🚀 Showing popup for round:', event.roundId);

      // Mark this round as shown IMMEDIATELY to prevent duplicate popups
      shownRoundsRef.current.add(event.roundId);
      
      // Fetch winners count from stats API
      api.get(`/lottery/round/${event.roundId}/stats`)
        .then((stats) => {
          const data = stats.data;
          const winnersForBlock = data.blockStats?.[event.winningBlock - 1]?.totalBets ?? null;
          
          // Create round object from event data
          // Use event's drawnAt time or current time as fallback
          const completedRoundData: LotteryRound = {
            id: event.roundId,
            roundNumber: event.roundNumber,
            status: event.status,
            winningBlock: event.winningBlock,
            totalPool: event.totalPool,
            adminFee: 0, // Not needed for popup
            winnerPool: event.winnerPool,
            totalBets: 0, // Not needed for popup
            drawTime: event.drawnAt || new Date().toISOString(),
            drawnAt: event.drawnAt,
          };

          setCompletedRound(completedRoundData);
          setWinningBlockOverride(event.winningBlock);
          setWinnersCount(winnersForBlock);
          console.log('🎰 [LotteryPage] ✅ Setting showWinningPopup = true');
          console.log('🎰 [LotteryPage] Popup state will show for round:', event.roundId);
          setShowWinningPopup(true);

          // Update Recent Winners bar IMMEDIATELY with socket event data
          if (winnersForBlock !== null) {
            const newWinnerRound: WinnerRound = {
              roundNumber: event.roundNumber,
              winningBlock: event.winningBlock,
              winnersCount: winnersForBlock,
            };

            setRecentWinnersRounds((prev) => {
              // Deduplicate by roundNumber - remove existing if present
              const filtered = prev.filter((r) => r.roundNumber !== event.roundNumber);
              // Prepend new round to the beginning
              const updated = [newWinnerRound, ...filtered];
              // Keep max 10 items
              return updated.slice(0, 10);
            });

            console.log('🎰 [LotteryPage] ✅ Updated Recent Winners bar with round:', event.roundNumber);
          }
        })
        .catch((err) => {
          console.error('Error fetching round stats for popup:', err);
          // Still show popup with event data even if stats fetch fails
          const completedRoundData: LotteryRound = {
            id: event.roundId,
            roundNumber: event.roundNumber,
            status: event.status,
            winningBlock: event.winningBlock,
            totalPool: event.totalPool,
            adminFee: 0,
            winnerPool: event.winnerPool,
            totalBets: 0,
            drawTime: event.drawnAt || new Date().toISOString(),
            drawnAt: event.drawnAt,
          };
          setCompletedRound(completedRoundData);
          setWinningBlockOverride(event.winningBlock);
          console.log('🎰 [LotteryPage] ✅ Setting showWinningPopup = true (fallback, stats fetch failed)');
          console.log('🎰 [LotteryPage] Popup state will show for round:', event.roundId);
          setShowWinningPopup(true);

          // Update Recent Winners bar even if stats fetch failed (use 0 as fallback)
          const newWinnerRound: WinnerRound = {
            roundNumber: event.roundNumber,
            winningBlock: event.winningBlock,
            winnersCount: 0, // Fallback: will show as 0 if stats unavailable
          };

          setRecentWinnersRounds((prev) => {
            // Deduplicate by roundNumber
            const filtered = prev.filter((r) => r.roundNumber !== event.roundNumber);
            // Prepend new round
            const updated = [newWinnerRound, ...filtered];
            // Keep max 10 items
            return updated.slice(0, 10);
          });

          console.log('🎰 [LotteryPage] ✅ Updated Recent Winners bar (fallback) with round:', event.roundNumber);
        });
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, []); // Empty deps - only run once on mount

  // Listen for user:balance:updated events via Socket.IO (SOCKET-FIRST, no HTTP)
  useEffect(() => {
    const unsubscribe = socketService.onUserBalanceUpdated((event: UserBalanceUpdatedEvent) => {
      console.log('[LotteryPage] Received user:balance:updated event', event);
      // Optimistically update user balance from socket (instant, no HTTP)
      // Note: refreshUser is debounced in AuthContext, so this won't spam
      // But we prefer socket updates - only sync if needed
      if (user) {
        // Update user balance optimistically
        // The socket event has the exact balance, but we need to update the context
        // refreshUser is debounced, so this is safe
        refreshUser();
      }
    });

    return unsubscribe;
  }, [refreshUser, user]);

  const handleToggleNumber = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    setBuyError(null);
  };

  const handleBuy = async (amount: number, rounds: number, mode: PurchaseMode) => {
    if (!user || !activeRound || !isAuthReady) return;

    setBuying(true);
    setBuyError(null);

    try {
      // Get current user buys in this round for validation
      // This is guarded to prevent duplicate simultaneous validation calls
      const userBets = await betsService.getUserBets(100);
      const roundBets = userBets.filter(bet => bet.lotteryRoundId === activeRound.id);
      const currentBuysCount = roundBets.length;
      const currentTotalBuy = roundBets.reduce((sum, bet) => sum + Number(bet.amount), 0);

      if (mode === PurchaseMode.SINGLE) {
        // Validate single buy
        const validation = validateBuy(
          amount,
          selectedIds.length,
          currentBuysCount,
          currentTotalBuy,
          language
        );

        if (!validation.valid) {
          setBuyError(validation.error || 'Invalid buy');
          setBuying(false);
          return;
        }

        // Place buys for each selected block
        // Socket events will update UI instantly (bet:placed, user:balance:updated)
        for (const blockId of selectedIds) {
          await betsService.placeBet(blockId, amount);
        }
      } else {
        // Validate auto buy
        if (hasActiveAutoBuy) {
          setBuyError(language === 'en' ? 'You already have an active Auto Buy plan' : 'အသက်ရှိသော Auto Buy အစီအစဉ် ရှိပြီးသားဖြစ်သည်');
          setBuying(false);
          return;
        }

        const validation = validateAutoBuy(
          selectedIds,
          amount,
          rounds,
          currentBuysCount,
          currentTotalBuy,
          language
        );

        if (!validation.valid) {
          setBuyError(validation.error || 'Invalid auto buy');
          setBuying(false);
          return;
        }

        // Create auto buy plan
        await autobetService.createPlan({
          blocks: selectedIds,
          betAmountPerBlock: amount,
          totalRounds: rounds,
        });
        
        // Trigger AutoBuyPlans refresh
        setAutoBuyRefreshKey(prev => prev + 1);
      }

      // SOCKET-FIRST APPROACH: No immediate HTTP refetch
      // Socket events (bet:placed, user:balance:updated) will update UI instantly
      // Clear selection immediately for better UX
      setSelectedIds([]);
      
      // Schedule ONE delayed sync fetch (3+ seconds) as safety net
      // This is debounced in useLotteryData, so multiple bets won't cause spam
      setTimeout(() => {
        // This will be debounced by useLotteryData's debounced fetches
        refetch().catch((err) => {
          // Silent fail - socket already updated UI
          console.warn('[LotteryPage] Delayed sync fetch failed (non-critical, socket already updated):', err);
        });
      }, 3500); // 3.5 seconds - after debounce window
      
    } catch (error: any) {
      // Only show error if bet placement actually failed
      setBuyError(
        error.response?.data?.message || 
        (language === 'my' ? 'ဝယ်ယူမှု မအောင်မြင်ပါ' : 'Purchase failed')
      );
    } finally {
      setBuying(false);
    }
  };

  return (
    <div className="min-h-screen bg-ios-bg-primary text-white font-sans selection:bg-ios-blue/30 overflow-x-hidden relative">
        
        {/* DEV Mode Badge */}
        {import.meta.env.DEV && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-ios-yellow text-black text-center py-1 text-xs font-bold">
            🔧 DEV MODE - Mock Telegram User
          </div>
        )}
        
        {/* Subtle Apple Style Glows using Dark Palette */}
        <div className="fixed inset-0 pointer-events-none">
            <div className="absolute top-[-20%] left-[20%] w-[600px] h-[600px] bg-ios-blue/10 rounded-full blur-[150px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-ios-indigo/10 rounded-full blur-[150px]" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto pb-24 md:pb-8">
            {/* Header */}
            <header className="px-4 py-6 flex justify-between items-center sticky top-0 z-40 bg-ios-bg-primary/80 backdrop-blur-xl md:bg-transparent md:backdrop-blur-none border-b border-white/5 md:border-none">
                <div 
                    onClick={() => setIsPointsOpen(true)}
                    className="flex items-center space-x-2 bg-ios-gray5 hover:bg-ios-gray4 rounded-full px-3 py-1.5 cursor-pointer transition-all active:scale-95"
                >
                    <div className="bg-ios-pink p-1 rounded-full">
                        <Icons.Gift size={12} className="text-white" />
                    </div>
                    <span className="text-[13px] font-semibold text-white">{user?.points?.toLocaleString() || 0}</span>
                </div>

                <div className="flex items-center space-x-3">
                    <button
                        onClick={() => setShowHowItWorks(true)}
                        className="p-2 rounded-full bg-ios-gray5 hover:bg-ios-gray4 transition-colors active:scale-95"
                        title={language === 'en' ? 'How It Works' : 'ဘယ်လိုအလုပ်လုပ်လဲ'}
                    >
                        <Icons.Info size={18} className="text-white" />
                    </button>
                     <div 
                        onClick={() => setIsWalletOpen(true)}
                        className="flex items-center space-x-2 bg-ios-gray5 hover:bg-ios-gray4 rounded-full pl-3 pr-1 py-1 cursor-pointer transition-all active:scale-95"
                     >
                        <span className="text-[13px] font-semibold text-white">{(user?.kyatBalance || 0).toLocaleString()} Ks</span>
                         <div className="bg-ios-green p-1.5 rounded-full">
                            <Icons.Wallet size={12} className="text-white" />
                        </div>
                    </div>
                    <LanguageToggle language={language} setLanguage={setLanguage} />
                </div>
            </header>

            <main className="flex flex-col lg:flex-row lg:items-start lg:space-x-8 px-4 mt-4">
                
                {/* Left Column: Grid */}
                <div className="flex-1 mb-8 lg:mb-0">
                    <div className="flex items-center justify-between mb-6 px-1">
                        <h1 className="text-[28px] font-extrabold italic tracking-tight text-white">
                            {(TRANSLATIONS.app_title as { en: string; my: string })[language] || '1K Dream'}
                        </h1>
                        <div className="flex items-center text-[11px] font-semibold text-ios-green bg-ios-green/10 px-2 py-1 rounded-md">
                            <div className="w-1.5 h-1.5 rounded-full bg-ios-green animate-pulse mr-2" />
                            LIVE
                        </div>
                    </div>

                    <div className="flex justify-center mb-3">
                      <p className="text-[11px] text-ios-label-secondary">
                        {language === 'en' ? 'Choose your number' : 'သင်တို့ နံပါတ်ကို ရွေးချယ်ပါ'}
                      </p>
                    </div>

                    {/* Non-blocking error banner - blocks still render below */}
                    {/* Only show error if we don't have cached round data AND error exists */}
                    {dataError && !activeRound && errorBannerVisible && (
                      <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-200 flex items-center justify-between">
                        <span className="mr-2">
                          {language === 'en'
                            ? 'Unable to load round data. Blocks are still available.'
                            : 'ပွဲစဉ်ဒေတာ မဖတ်ရနိုင်သေးပါ။ နံပါတ်များ ဆက်လက်ရရှိနိုင်ပါသည်။'}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setErrorBannerVisible(false);
                              refetch();
                            }}
                            className="text-[11px] font-semibold px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 transition-colors"
                          >
                            {language === 'en' ? 'Retry' : 'ပြန်ဖတ်မည်'}
                          </button>
                          <button
                            onClick={() => setErrorBannerVisible(false)}
                            className="text-[11px] font-semibold px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* BLOCKS ALWAYS RENDER - NO CONDITIONS */}
                    <NumberGrid 
                        numbers={numbersState} 
                        selectedIds={selectedIds} 
                        onToggleNumber={handleToggleNumber}
                    />
                </div>

                {/* Right Column: Info & Buy */}
                <div className="lg:w-96 flex-shrink-0">
                   <div className="lg:sticky lg:top-8 space-y-4">
                       {/* Admin Panel - Top of right column for visibility */}
                       <AdminPanel />
                       
                       <RoundPanel 
                         language={language} 
                         round={activeRound}
                         countdown={countdown}
                         userStake={userStake}
                         loading={dataLoading}
                       />
                       
                       {/* User's bets for this round */}
                       <MyBetsThisRound
                         language={language}
                         roundId={activeRound?.id || null}
                         refreshKey={historyRefreshKey}
                       />
                       
                       {user && (
                         <AutoBuyPlans 
                           language={language}
                           userId={user.id}
                           refreshKey={autoBuyRefreshKey}
                           onPlanCancelled={async () => {
                             await refreshUser();
                             await refetch();
                             setAutoBuyRefreshKey(prev => prev + 1);
                           }}
                         />
                       )}
                       <PurchaseControl 
                         language={language} 
                         selectedCount={selectedIds.length} 
                         onBuy={handleBuy}
                         disabled={buying || !user || !activeRound}
                         loading={buying}
                         error={buyError}
                         disableAutoBuy={hasActiveAutoBuy}
                       />
                       
                       {/* Footer info */}
                       <div className="text-center mt-8 opacity-40">
                          <p className="text-[10px] font-medium uppercase tracking-widest text-ios-label-secondary">Secure • Transparent • Daily</p>
                       </div>
                   </div>
                </div>
            </main>
            
            {/* Winning history below all content */}
            <div className="px-4 mt-6">
              <WinningHistoryBar 
                language={language} 
                limit={10} 
                refreshKey={winnersRefreshKey}
                recentWinners={recentWinnersRounds.length > 0 ? recentWinnersRounds : undefined}
              />
              <div className="mt-4">
                <UserRoundHistory language={language} refreshKey={historyRefreshKey} />
              </div>
            </div>
        </div>

        {/* Modals */}
        <PointsModal 
            language={language} 
            isOpen={isPointsOpen} 
            onClose={() => setIsPointsOpen(false)} 
            points={user?.points || 0}
            user={user}
            onRefresh={refreshUser}
        />
        <WalletModal 
            language={language} 
            isOpen={isWalletOpen} 
            onClose={() => setIsWalletOpen(false)} 
            balance={user?.kyatBalance || 0}
            user={user}
            onRefresh={refreshUser}
        />

        <TonAddressModal
          language={language}
          isOpen={showTonAddressModal}
          onClose={() => setShowTonAddressModal(false)}
          onSuccess={refreshUser}
        />

        <WinningPopup
          language={language}
          round={completedRound}
          winningBlockOverride={winningBlockOverride}
          winnersCount={winnersCount ?? undefined}
          isOpen={showWinningPopup}
          onClose={() => {
            setShowWinningPopup(false);
            // Don't reset winningBlockOverride or winnersCount - keep them for potential re-display
            // Don't remove from shownRoundsRef - we've already shown it, don't show again
            // Refresh data after popup closes
            refetch();
            refreshUser();
            setWinnersRefreshKey(prev => prev + 1);
            setHistoryRefreshKey(prev => prev + 1);
          }}
        />

        <HowItWorksModal
          language={language}
          isOpen={showHowItWorks}
          onClose={() => setShowHowItWorks(false)}
        />

    </div>
  );
};

export default LotteryPage;

