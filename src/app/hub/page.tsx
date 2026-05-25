'use client';

import { useState, useEffect } from 'react';
import { motion, Variants } from 'framer-motion';
import { 
  Calendar, 
  ShoppingCart, 
  Plane, 
  TrendingUp, 
  History, 
  Users, 
  MessageSquare, 
  Workflow, 
  ChefHat, 
  Activity,
  ArrowRight,
  Zap,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import { BottomNav } from '@/components/layout/BottomNav';
import { useDashboardData } from '@/lib/hooks/useDashboardData';

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const item: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  show: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { type: 'spring', damping: 20, stiffness: 100 }
  }
};

const HUB_GROUPS = [
  {
    title: 'Planning & Logistics',
    items: [
      { name: 'Meal Planner', href: '/pantry', icon: Calendar, color: 'var(--primary)', isPremium: true },
      { name: 'Shopping List', href: '/shopping', icon: ShoppingCart, color: 'var(--primary)', isPremium: true },
    ]
  },
  {
    title: 'Biometric Tools',
    items: [
      { name: 'Menu Scanner', href: '/travel/menu', icon: Plane, color: 'var(--primary)', isPremium: true },
      { name: 'Offline Log', href: '/log/offline', icon: Activity, color: 'var(--text-secondary)' },
    ]
  },
  {
    title: 'Insights & Neural Core',
    items: [
      { name: 'Analytics', href: '/analytics', icon: TrendingUp, color: 'var(--primary)', isPremium: true },
      { name: 'History', href: '/history', icon: History, color: 'var(--primary)' },
      { name: 'Household', href: '/social', icon: Users, color: 'var(--primary)' },
      { name: 'AI Coach', href: '/coach', icon: MessageSquare, color: 'var(--primary)', isPremium: true },
    ]
  },
  {
    title: 'System Protocols',
    items: [
      { name: 'Workflows', href: '/workflows', icon: Workflow, color: 'var(--primary)' },
      { name: 'Premium Tier', href: '/pricing', icon: Zap, color: 'var(--primary)' },
      { name: 'Medical Guide', href: '/about', icon: ShieldCheck, color: 'var(--text-secondary)' },
    ]
  }
];

export default function HubPage() {
  const { user } = useDashboardData();
  const isPro = user?.plan === 'pro';
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-app)] pb-32 text-[var(--text-primary)] transition-colors duration-500">
      <header className="pt-safe px-6 pb-8 bg-gradient-to-b from-[var(--primary)]/5 to-transparent">
        <div className="flex items-center gap-2 mt-8 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] shadow-[0_0_10px_var(--primary)]" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--primary)]">Neural Interface</span>
        </div>
        <h1 className="text-4xl font-light tracking-tight text-[var(--text-primary)]">Control Center</h1>
        <p className="text-[var(--text-secondary)] text-xs font-bold uppercase tracking-widest mt-1 opacity-60">
            System uptime: {mounted ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'} • Mode: {isPro ? 'SOLAR_ELITE' : 'CORE_ACTIVE'}
        </p>
      </header>

      <motion.main 
        variants={container}
        initial="hidden"
        animate="show"
        className="px-6 space-y-10 mt-4 relative z-10"
      >
        {HUB_GROUPS.map((group) => (
          <div key={group.title} className="space-y-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-secondary)] opacity-40 px-1">{group.title}</h2>
            <div className="grid grid-cols-2 gap-4">
              {group.items.map((hubItem) => {
                const needsPro = hubItem.isPremium && !isPro;
                return (
                    <motion.div key={hubItem.name} variants={item}>
                    <Link 
                        href={needsPro ? '/pricing' : hubItem.href}
                        className="flex flex-col p-5 rounded-[28px] bg-[var(--bg-surface)] border border-[var(--border)] backdrop-blur-md active:scale-95 transition-all duration-300 group shadow-sm relative overflow-hidden h-full"
                    >
                        {/* Glow effect */}
                        <div className="absolute top-0 right-0 w-20 h-20 bg-[var(--primary)]/5 rounded-full blur-2xl group-hover:bg-[var(--primary)]/10 transition-colors" />
                        
                        <div className="w-12 h-12 bg-[var(--bg-app)] rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform border border-[var(--border)] shadow-inner">
                        <hubItem.icon style={{ color: hubItem.color }} size={24} strokeWidth={1.5} />
                        </div>
                        
                        <div className="flex items-center justify-between mt-auto">
                        <div>
                            <span className="text-sm font-bold text-[var(--text-primary)] block">{hubItem.name}</span>
                            {hubItem.isPremium && (
                                <span className={`text-[8px] font-black uppercase tracking-wider ${isPro ? 'text-[var(--primary)]' : 'text-[var(--text-secondary)] opacity-40'}`}>
                                    {isPro ? 'ACTIVE' : 'PREMIUM'}
                                </span>
                            )}
                        </div>
                        <ArrowRight size={14} className="text-[var(--text-secondary)] opacity-20 group-hover:opacity-100 group-hover:text-[var(--primary)] transition-all transform group-hover:translate-x-1" />
                        </div>

                        {needsPro && (
                            <div className="absolute top-3 right-3">
                                <Sparkles size={12} className="text-[var(--primary)]" />
                            </div>
                        )}
                    </Link>
                    </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </motion.main>

      <BottomNav />
    </div>
  );
}
