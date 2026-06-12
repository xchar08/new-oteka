'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Check, Sparkles, Zap, Flame, Crown, Loader2, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BottomNav } from '@/components/layout/BottomNav';
import { useUser } from '@/lib/hooks/useUser';
import { subscriptionService } from '@/lib/services/subscription.service';
import { toast } from 'sonner';

export default function PricingPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const queryClient = useQueryClient();
  const [upgrading, setUpgrading] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  // Annual leads; monthly exists to make annual look smart
  const [billing, setBilling] = useState<'year' | 'month'>('year');

  // Price IDs + display amounts live in the plans table (service-role
  // managed), never in code — price tests are an INSERT, not a deploy
  const { data: planPrices } = useQuery({
    queryKey: ['plans'],
    queryFn: () => subscriptionService.getPlans(),
    staleTime: 10 * 60 * 1000,
  });

  // Coach owners: join code + seat usage for their team
  const { data: coachTeam } = useQuery({
    queryKey: ['coach-team'],
    queryFn: () => subscriptionService.getMyCoachTeam(),
    enabled: user?.plan === 'coach',
    staleTime: 60 * 1000,
  });

  const fmtPrice = (cents: number | null | undefined): string | null =>
    cents == null ? null : `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

  const proPrice = planPrices?.pro?.[billing];
  const coachPrice = planPrices?.coach?.[billing];

  // "save N%" computed from real table prices when both intervals exist
  const proYear = planPrices?.pro?.year?.amountCents;
  const proMonth = planPrices?.pro?.month?.amountCents;
  const annualSavingsPct = proYear && proMonth
    ? Math.round((1 - proYear / 12 / proMonth) * 100)
    : 49;

  const perMonthEquiv = (cents: number | null | undefined): string | null =>
    cents == null ? null : `≈ $${(cents / 1200).toFixed(2)}/mo`;

  const handleUpgrade = async (priceId: string) => {
    if (!user) return;
    if (upgrading) return;
    
    setUpgrading(true);
    try {
        const data = await subscriptionService.createCheckoutSession(user.id, priceId);
        if (data?.url) {
            window.location.href = data.url;
        } else {
            throw new Error("No checkout URL returned");
        }
    } catch (err) {
        console.error("Upgrade error:", err);
        toast.error("Stripe Checkout failed. Please try again.");
        setUpgrading(false);
    }
  };

  // One input handles both voucher codes and coach team codes: vouchers are
  // tried first; an unrecognized voucher falls through to team join
  const handleRedeem = async () => {
    const code = voucherCode.trim();
    if (!code || redeeming) return;
    setRedeeming(true);
    try {
      const result = await subscriptionService.redeemVoucher(code);
      const until = result?.expires_at ? new Date(result.expires_at).toLocaleDateString() : null;
      toast.success(until ? `Solar unlocked until ${until}` : 'Voucher redeemed');
      setVoucherCode('');
      await queryClient.invalidateQueries();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (/invalid voucher/i.test(msg)) {
        try {
          const team = await subscriptionService.joinCoachTeam(code);
          toast.success(`Joined ${team.team_owner}'s team — Solar unlocked`);
          setVoucherCode('');
          await queryClient.invalidateQueries();
        } catch (teamErr) {
          const tmsg = teamErr instanceof Error ? teamErr.message : '';
          toast.error(/invalid team code/i.test(tmsg) ? 'Code not recognized' : (tmsg || 'Could not redeem this code'));
        }
      } else {
        toast.error(msg || 'Could not redeem this code');
      }
    } finally {
      setRedeeming(false);
    }
  };

  const plans = [
    {
        name: "Oteka Core",
        price: "$0",
        period: "Forever",
        priceId: null,
        desc: "Baseline metabolic tracking for dedicated explorers.",
        features: [
            "AI Meal Logging (10/day)",
            "Basic Nutrient Tracking",
            "Single Household Sync",
            "Standard Pantry Management"
        ],
        cta: "Current Plan",
        active: !user || user.plan === 'free',
        badge: null,
    },
    {
        name: "Oteka Solar",
        price: fmtPrice(proPrice?.amountCents) ?? (billing === 'year' ? "$79.99" : "$12.99"),
        period: billing === 'year' ? "per year" : "per month",
        priceNote: billing === 'year' ? (perMonthEquiv(proPrice?.amountCents) ?? "≈ $6.67/mo") : null,
        priceId: proPrice?.priceId ?? null,
        desc: "The ultimate neural engine for peak human performance.",
        features: [
            "Unlimited AI Vision Scans",
            "Full History Access",
            "NSGA-II Meal Optimization",
            "Advanced Metabolic Trends",
            "Priority AI Coach Access",
            "Travel Menu Parser"
        ],
        cta: user?.plan === 'pro' ? "Current Plan" : "Upgrade to Solar",
        active: user?.plan === 'pro',
        premium: true,
        badge: "Recommended",
    },
    {
        name: "Oteka Coach",
        price: fmtPrice(coachPrice?.amountCents) ?? (billing === 'year' ? "$1,199" : "$149"),
        period: billing === 'year' ? "per year" : "per month",
        priceNote: billing === 'year'
          ? "≈ $6.66 per athlete/mo"
          : "≈ $9.93 per athlete/mo",
        priceId: coachPrice?.priceId ?? null,
        desc: "Your whole roster on Solar — 15 athlete seats with one join code.",
        features: [
            "15 Athlete Seats Included",
            "Everything in Solar",
            "One-Code Team Onboarding",
            "Seats Managed Automatically",
            "Priority Support Channel"
        ],
        cta: user?.plan === 'coach' ? "Current Plan" : "Upgrade to Coach",
        active: user?.plan === 'coach',
        premium: true,
        badge: "For Teams",
        isCoach: true,
    }
  ];

  if (loading) return (
    <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] p-6 pb-32 transition-colors duration-500 font-sans">
      
      {/* Header */}
      <header className="flex items-center gap-4 pt-safe mb-8">
        <button 
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
        >
            <ChevronLeft size={24} />
        </button>
        <div>
           <h1 className="text-3xl font-black tracking-tight mb-1">Access</h1>
           <p className="text-[var(--text-secondary)] text-sm font-bold uppercase tracking-widest">Plans & Neural Tiers</p>
        </div>
      </header>

      <div className="space-y-6 max-w-xl mx-auto">
        {/* Billing period toggle — annual leads */}
        <div className="flex justify-center">
          <div role="group" aria-label="Billing period" className="flex bg-[var(--bg-surface)] p-1 rounded-xl border border-[var(--border)] shadow-sm">
            <button
              onClick={() => setBilling('year')}
              aria-pressed={billing === 'year'}
              className={`px-4 py-2 rounded-lg text-[11px] font-bold transition-all ${billing === 'year' ? 'bg-[var(--primary)] text-[var(--primary-fg)] shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            >
              Annual · save {annualSavingsPct}%
            </button>
            <button
              onClick={() => setBilling('month')}
              aria-pressed={billing === 'month'}
              className={`px-4 py-2 rounded-lg text-[11px] font-bold transition-all ${billing === 'month' ? 'bg-[var(--primary)] text-[var(--primary-fg)] shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            >
              Monthly
            </button>
          </div>
        </div>

        {plans.map((plan, idx) => (
            <motion.div 
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`relative p-8 rounded-[40px] border transition-all duration-500 overflow-hidden ${
                    (plan as any).isCoach
                    ? 'bg-gradient-to-br from-[var(--secondary)] to-[#3a1c00] border-[var(--primary)] text-white ring-2 ring-[var(--primary)]/60 ring-offset-4 ring-offset-[var(--bg-app)] shadow-2xl shadow-[var(--primary)]/15'
                    : plan.premium
                    ? 'bg-[var(--secondary)] border-[var(--primary)] text-white ring-2 ring-[var(--primary)] ring-offset-4 ring-offset-[var(--bg-app)] shadow-2xl shadow-[var(--primary)]/20'
                    : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] shadow-sm'
                }`}
            >
                {plan.premium && (
                  <div className="absolute -top-16 -right-16 w-48 h-48 bg-[var(--primary)]/15 rounded-full blur-3xl pointer-events-none" />
                )}
                {plan.badge && (
                    <div className={`absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg flex items-center gap-2 ${
                        (plan as any).isCoach 
                        ? 'bg-gradient-to-r from-[var(--primary)] to-amber-500 text-white' 
                        : 'bg-[var(--primary)] text-white'
                    }`}>
                        {(plan as any).isCoach ? <Users size={12} /> : <Crown size={12} />} {plan.badge}
                    </div>
                )}

                <div className="mb-8">
                    <h3 className={`text-xl font-black mb-1 ${plan.premium ? 'text-[var(--primary)]' : ''}`}>{plan.name}</h3>
                    <p className={`text-xs font-medium opacity-60 leading-relaxed`}>{plan.desc}</p>
                </div>

                <div className="mb-8">
                    <div className="flex items-baseline gap-2">
                        <span className="font-display text-5xl font-extrabold tracking-tighter">{plan.price}</span>
                        <span className="text-xs font-bold uppercase tracking-widest opacity-40">{plan.period}</span>
                    </div>
                    {(plan as { priceNote?: string | null }).priceNote && (
                        <p className="text-[11px] font-semibold opacity-60 mt-1 font-mono tabular-nums">{(plan as { priceNote?: string | null }).priceNote}</p>
                    )}
                </div>

                <div className="space-y-4 mb-10">
                    {plan.features.map((feat) => (
                        <div key={feat} className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${plan.premium ? 'bg-[var(--primary)]/20 text-[var(--primary)]' : 'bg-[var(--primary)]/10 text-[var(--primary)]'}`}>
                                <Check size={12} strokeWidth={4} />
                            </div>
                            <span className="text-sm font-medium opacity-90">{feat}</span>
                        </div>
                    ))}
                </div>

                <button
                    disabled={plan.active || !plan.premium || upgrading}
                    onClick={() => {
                        if (!plan.premium || plan.active) return;
                        if (plan.priceId) {
                            handleUpgrade(plan.priceId);
                        } else {
                            toast.error("This plan isn't available for purchase yet.");
                        }
                    }}
                    className={`relative overflow-hidden w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2 ${
                        plan.active
                        ? plan.premium
                            ? 'bg-[var(--primary)] text-white ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--secondary)] cursor-default'
                            : 'bg-[var(--bg-app)] border border-[var(--border)] text-[var(--text-secondary)] opacity-50 cursor-default'
                        : plan.premium
                        ? 'shine bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white hover:opacity-95'
                        : 'bg-[var(--text-primary)] text-white hover:bg-[var(--text-secondary)]'
                    }`}
                >
                    {upgrading && plan.premium ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : plan.cta}
                </button>
            </motion.div>
        ))}

        {/* Coach team management (coach plan only) */}
        {user?.plan === 'coach' && coachTeam && (
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[28px] p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[13px] font-semibold text-[var(--text-secondary)]">Your team</h2>
                <p className="text-xs text-[var(--text-secondary)] font-medium mt-1">Athletes enter this code below to claim a seat.</p>
              </div>
              <span className="font-mono text-xs font-bold tabular-nums text-[var(--text-primary)] shrink-0">
                {coachTeam.seats_used} / {coachTeam.seat_limit} seats
              </span>
            </div>
            <div className="mt-4 flex gap-2 items-center">
              <code className="min-w-0 flex-1 h-12 flex items-center px-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-2)] font-mono text-base font-bold tracking-[0.2em] text-[var(--text-primary)] overflow-x-auto">
                {coachTeam.join_code}
              </code>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(coachTeam.join_code);
                    toast.success('Team code copied');
                  } catch {
                    toast.error('Could not copy — select the code manually');
                  }
                }}
                className="h-12 px-4 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl text-[11px] font-bold text-[var(--text-primary)] active:scale-95 transition-transform shrink-0"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {/* Access codes: vouchers + coach team codes */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[28px] p-6">
          <h2 className="text-[13px] font-semibold text-[var(--text-secondary)]">Have a code?</h2>
          <p className="text-xs text-[var(--text-secondary)] font-medium mt-1">Voucher passes and coach team codes both work here.</p>
          <div className="mt-4 flex gap-2">
            <input
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRedeem(); }}
              placeholder="VOUCHER-CODE"
              aria-label="Voucher code"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="min-w-0 flex-1 h-12 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-2)] px-4 text-sm font-mono tracking-wider text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
            />
            <button
              onClick={handleRedeem}
              disabled={redeeming || !voucherCode.trim()}
              className="h-12 px-5 bg-[var(--primary)] text-[var(--primary-fg)] rounded-xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-transform disabled:opacity-50 shrink-0"
            >
              {redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Redeem'}
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest pt-4 opacity-40">
            Secure processing via Stripe • Cancel anytime
        </p>
      </div>

      <BottomNav />
    </div>
  );
}
