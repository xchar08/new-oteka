'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, PlusCircle, List, User, LayoutGrid, UtensilsCrossed, Package, Camera, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDashboardData } from '@/lib/hooks/useDashboardData';

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useDashboardData();
  const isPro = user?.plan === 'pro';
  
  const hideNavRoutes = ['/vision', '/onboarding', '/login'];
  if (hideNavRoutes.some(route => pathname?.startsWith(route))) return null;

  const navs = [
    { href: '/dashboard', icon: LayoutGrid, label: 'Hub' },
    { href: '/pantry', icon: Package, label: 'Pantry' },
    { href: '/travel/menu', icon: Camera, label: 'Menu', isPremium: true },
    { href: '/coach', icon: MessageSquare, label: 'Coach', isPremium: true },
    { href: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[var(--bg-surface)]/80 backdrop-blur-xl border-t border-[var(--primary)]/5 pb-safe pt-2 px-4 z-50 shadow-[0_-10px_40px_rgba(var(--ring),0.05)]">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        {navs.map((n) => {
          const isActive = pathname === n.href;
          const Icon = n.icon;
          const isElite = n.isPremium && isPro;
          const needsPro = n.isPremium && !isPro;
          
          return (
            <Link 
              key={n.label} 
              href={needsPro ? '/pricing' : n.href} 
              className={`flex flex-col items-center gap-1 transition-all duration-300 relative ${isActive ? 'text-[var(--primary)]' : isElite ? 'text-[var(--primary)]' : 'text-[var(--text-secondary)]/40'}`}
            >
              <motion.div 
                animate={isActive ? { y: -2, scale: 1.1 } : { y: 0, scale: 1 }}
                className={`p-2 rounded-2xl transition-colors ${isActive ? 'bg-[var(--primary)]/10' : isElite ? 'bg-[var(--primary)]/5' : 'bg-transparent'}`}
              >
                <Icon size={24} strokeWidth={isActive || isElite ? 2.5 : 2} className={isElite && !isActive ? 'opacity-80' : ''} />
              </motion.div>
              <span className={`text-[8px] font-black uppercase tracking-[0.2em] transition-all ${isActive || isElite ? 'opacity-100' : 'opacity-40'}`}>
                {n.label}
              </span>
              {isActive && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute -top-2 w-8 h-1 bg-[var(--primary)] rounded-full shadow-[0_0_10px_var(--primary)]"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
