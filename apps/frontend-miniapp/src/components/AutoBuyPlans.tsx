import React, { useState, useEffect } from 'react';
import { GlassCard } from './GlassCard';
import { Language } from '../types/ui';
import { TRANSLATIONS } from '../constants/translations';
import { Icons } from './Icons';
import { autobetService, AutoBetPlan } from '../services/autobet';

interface Props {
  language: Language;
  userId: string;
  refreshKey?: number; // Trigger refresh when this changes
  onPlanCancelled?: () => void;
}

export const AutoBuyPlans: React.FC<Props> = ({ language, userId, refreshKey, onPlanCancelled }) => {
  const [plans, setPlans] = useState<AutoBetPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
  }, [userId, refreshKey]); // Reload when userId or refreshKey changes

  const loadPlans = async () => {
    try {
      setLoading(true);
      const userPlans = await autobetService.getUserPlans();
      // Show only active plans (cancellable)
      const visiblePlans = userPlans.filter(p => p.status === 'active');
      setPlans(visiblePlans);
    } catch (error) {
      console.error('Error loading auto-buy plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (planId: string) => {
    if (!confirm(language === 'en' 
      ? 'Are you sure you want to cancel this auto-buy plan? Unused rounds will be refunded.'
      : 'ဤအလိုအလျောက်ဝယ်ယူမှု အစီအစဉ်ကို ပယ်ဖျက်လိုပါသလား? အသုံးမပြုရသေးသော အကြိမ်များကို ပြန်လည်ပေးအပ်ပါမည်။'
    )) {
      return;
    }

    try {
      setCancelling(planId);
      await autobetService.cancelPlan(planId);
      await loadPlans();
      if (onPlanCancelled) {
        onPlanCancelled();
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to cancel plan');
    } finally {
      setCancelling(null);
    }
  };

  if (loading) {
    return (
      <GlassCard className="w-full mb-4">
        <div className="flex justify-center items-center py-4">
          <span className="text-ios-label-secondary text-sm">{TRANSLATIONS.loading[language]}</span>
        </div>
      </GlassCard>
    );
  }

  if (plans.length === 0) {
    return null; // Don't show anything if no active plans
  }

  return (
    <GlassCard className="w-full mb-4">
      <div className="flex items-center space-x-2 mb-4">
        <div className="p-2 bg-ios-blue/15 rounded-full text-ios-blue">
          <Icons.Clock size={18} />
        </div>
        <h3 className="text-sm font-semibold text-white">
          {language === 'en' ? 'Active Auto-Buy Plans' : 'အလိုအလျောက်ဝယ်ယူမှု အစီအစဉ်များ'}
        </h3>
      </div>

      <div className="space-y-3">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="p-3 rounded-xl bg-ios-gray5 border border-white/5"
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-xs text-ios-label-secondary">
                    {language === 'en' ? 'Blocks' : 'ဘလောက်များ'}: 
                  </span>
                  <span className="text-xs font-medium text-white">
                    {plan.blocks.map(b => b.toString().padStart(2, '0')).join(', ')}
                  </span>
                </div>
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-xs text-ios-label-secondary">
                    {language === 'en' ? 'Amount per block' : 'ဘလောက်တစ်ခုစီအတွက် ပမာဏ'}: 
                  </span>
                  <span className="text-xs font-medium text-white">
                    {plan.betAmountPerBlock.toLocaleString()} K
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-ios-label-secondary">
                    {language === 'en' ? 'Remaining rounds' : 'ကျန်ရှိသော အကြိမ်များ'}: 
                  </span>
                  <span className="text-xs font-semibold text-ios-yellow">
                    {plan.roundsRemaining} / {plan.totalRounds}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleCancel(plan.id)}
                disabled={cancelling === plan.id}
                className="px-3 py-1.5 text-xs font-medium text-ios-red bg-ios-red/10 rounded-lg hover:bg-ios-red/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelling === plan.id 
                  ? (language === 'en' ? 'Cancelling...' : 'ပယ်ဖျက်နေသည်...')
                  : (language === 'en' ? 'Cancel' : 'ပယ်ဖျက်မည်')
                }
              </button>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
};

