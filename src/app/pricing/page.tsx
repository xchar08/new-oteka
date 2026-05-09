'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Check, Sparkles, Zap, Flame, Crown, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/layout/BottomNav';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import { subscriptionService } from '@/lib/services/subscription.service';
import { toast } from 'sonner';

export default function PricingPage() {
  const router = useRouter();
  const { user, loading } = useDashboardData();
  const [upgrading, setUpgrading] = useState(false);

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
        active: !user || user.plan === 'free'
    },
    {
        name: "Oteka Solar",
        price: "$12",
        period: "per month",
        priceId: "price_1OTeKaSolarMonth", // Replace with your actual Stripe Price ID
        desc: "The ultimate neural engine for peak human performance.",
        features: [
            "Unlimited AI Vision Scans",
            "NSGA-II Meal Optimization",
            "Advanced Metabolic Trends",
            "Priority AI Coach Access",
            "Travel Menu Parser"
        ],
        cta: user?.plan === 'pro' ? "Current Plan" : "Upgrade to Solar",
        active: user?.plan === 'pro',
        premium: true
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
        {plans.map((plan, idx) => (
            <motion.div 
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`relative p-8 rounded-[40px] border transition-all duration-500 shadow-sm ${
                    plan.premium 
                    ? 'bg-[var(--secondary)] border-[var(--primary)] text-white ring-2 ring-[var(--primary)] ring-offset-4 ring-offset-[var(--bg-app)]' 
                    : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)]'
                }`}
            >
                {plan.premium && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[var(--primary)] text-white px-6 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg flex items-center gap-2">
                        <Crown size={12} /> Recommended
                    </div>
                )}

                <div className="mb-8">
                    <h3 className={`text-xl font-black mb-1 ${plan.premium ? 'text-[var(--primary)]' : ''}`}>{plan.name}</h3>
                    <p className={`text-xs font-medium opacity-60 leading-relaxed`}>{plan.desc}</p>
                </div>

                <div className="flex items-baseline gap-2 mb-8">
                    <span className="text-5xl font-black tracking-tighter">{plan.price}</span>
                    <span className="text-xs font-bold uppercase tracking-widest opacity-40">{plan.period}</span>
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
                    disabled={plan.active || (plan.premium && upgrading)}
                    onClick={() => {
                        if (!plan.active && plan.priceId) {
                            handleUpgrade(plan.priceId);
                        } else if (!plan.active) {
                            alert("You are already on the Core plan.");
                        }
                    }}
                    className={`w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2 ${
                        plan.active 
                        ? plan.premium
                            ? 'bg-[var(--primary)] text-white ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--secondary)] cursor-default'
                            : 'bg-[var(--bg-app)] border border-[var(--border)] text-[var(--text-secondary)] opacity-50 cursor-default'
                        : plan.premium 
                        ? 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]' 
                        : 'bg-[var(--text-primary)] text-white hover:bg-[var(--text-secondary)]'
                    }`}
                >
                    {upgrading && plan.premium ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : plan.cta}
                </button>
            </motion.div>
        ))}

        <p className="text-center text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest pt-4 opacity-40">
            Secure processing via Stripe • Cancel anytime
        </p>
      </div>

      <BottomNav />
    </div>
  );
}
