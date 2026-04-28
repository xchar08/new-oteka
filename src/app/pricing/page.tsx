'use client';

import { motion } from 'framer-motion';
import { ChevronLeft, Check, Sparkles, Zap, Flame, Crown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/layout/BottomNav';

export default function PricingPage() {
  const router = useRouter();

  const plans = [
    {
        name: "Oteka Core",
        price: "$0",
        period: "Forever",
        desc: "Baseline metabolic tracking for dedicated explorers.",
        features: [
            "AI Meal Logging (10/day)",
            "Basic Nutrient Tracking",
            "Single Household Sync",
            "Standard Pantry Management"
        ],
        cta: "Current Plan",
        active: true
    },
    {
        name: "Oteka Solar",
        price: "$12",
        period: "per month",
        desc: "The ultimate neural engine for peak human performance.",
        features: [
            "Unlimited AI Vision Scans",
            "NSGA-II Meal Optimization",
            "Advanced Metabolic Trends",
            "Priority AI Coach Access",
            "Travel Menu Parser"
        ],
        cta: "Upgrade to Solar",
        active: false,
        premium: true
    }
  ];

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
                    : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-primary)]'
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
                    disabled={plan.active}
                    onClick={() => !plan.active && alert("Stripe checkout would open here.")}
                    className={`w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 shadow-lg ${
                        plan.active 
                        ? 'bg-[var(--bg-app)] border border-[var(--border)] text-[var(--text-secondary)] opacity-50 cursor-default' 
                        : plan.premium 
                        ? 'bg-[var(--primary)] text-white' 
                        : 'bg-[var(--text-primary)] text-white'
                    }`}
                >
                    {plan.cta}
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
