'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, PlusCircle, List, User, LayoutGrid, UtensilsCrossed, Package } from 'lucide-react';
import { motion } from 'framer-motion';

export function BottomNav() {
  const pathname = usePathname();
  
  const hideNavRoutes = ['/vision', '/onboarding', '/login'];
  if (hideNavRoutes.some(route => pathname?.startsWith(route))) return null;

  const navs = [
    { href: '/dashboard', icon: LayoutGrid, label: 'Hub' },
    { href: '/log', icon: UtensilsCrossed, label: 'Log' },
    { href: '/pantry', icon: Package, label: 'Pantry' },
    { href: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-[#FF8C00]/5 pb-safe pt-2 px-6 z-50 shadow-[0_-10px_40px_rgba(255,140,0,0.05)]">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        {navs.map((n) => {
          const isActive = pathname === n.href;
          const Icon = n.icon;
          
          return (
            <Link 
              key={n.label} 
              href={n.href} 
              className={`flex flex-col items-center gap-1 transition-all duration-300 relative ${isActive ? 'text-[#FF8C00]' : 'text-gray-300'}`}
            >
              <motion.div 
                animate={isActive ? { y: -2, scale: 1.1 } : { y: 0, scale: 1 }}
                className={`p-2 rounded-2xl transition-colors ${isActive ? 'bg-[#FF8C00]/10' : 'bg-transparent'}`}
              >
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              </motion.div>
              <span className={`text-[8px] font-black uppercase tracking-[0.2em] transition-all ${isActive ? 'opacity-100 translate-y-0' : 'opacity-40 translate-y-1'}`}>
                {n.label}
              </span>
              {isActive && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute -top-2 w-8 h-1 bg-[#FF8C00] rounded-full"
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
