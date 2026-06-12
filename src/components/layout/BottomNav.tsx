'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, LayoutGrid, Package, Camera, MessageSquare, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useUser } from '@/lib/hooks/useUser';
import { isPaidPlan } from '@/lib/utils/plan';

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const isPro = isPaidPlan(user?.plan);

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
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-safe pointer-events-none">
      {/* Floating glass dock */}
      <div className="pointer-events-auto max-w-md mx-auto mb-3 rounded-[28px] border border-[var(--border)] bg-[var(--bg-surface)]/75 backdrop-blur-2xl shadow-[0_16px_40px_-12px_rgba(var(--shadow-color),0.5)] relative overflow-hidden">
        {/* Top hairline highlight */}
        <div className="absolute top-0 inset-x-6 h-px bg-gradient-to-r from-transparent via-[var(--primary)]/40 to-transparent" />

        <div className="flex justify-around items-center h-[68px] px-2">
          {navs.map((n) => {
            const isActive = pathname === n.href;
            const Icon = n.icon;
            const needsPro = n.isPremium && !isPro;

            return (
              <Link
                key={n.label}
                href={needsPro ? '/pricing' : n.href}
                aria-label={n.label}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center gap-0.5 w-14 h-full transition-colors duration-300 ${
                  isActive ? 'text-[var(--primary-text)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {/* Active halo */}
                {isActive && (
                  <motion.div
                    layoutId="nav-halo"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    className="absolute inset-x-0 top-1.5 bottom-1.5 rounded-2xl bg-[var(--primary)]/10 border border-[var(--primary)]/15"
                  />
                )}

                <motion.div
                  animate={isActive ? { y: -1, scale: 1.08 } : { y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                  className="relative"
                >
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                  {needsPro && (
                    <span className="absolute -top-1.5 -right-2 w-3.5 h-3.5 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] flex items-center justify-center shadow-sm">
                      <Lock size={7} strokeWidth={3.5} />
                    </span>
                  )}
                </motion.div>

                <span className="relative text-[10px] font-semibold">
                  {n.label}
                </span>

                {/* Active glow dot */}
                {isActive && (
                  <motion.div
                    layoutId="nav-dot"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    className="absolute -bottom-px w-6 h-[3px] rounded-full bg-[var(--primary)] shadow-[0_0_12px_var(--primary)]"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
