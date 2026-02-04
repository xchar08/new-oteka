'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, PlusCircle, User, List } from 'lucide-react';

export function BottomNav() {
  const pathname = usePathname();
  
  if (pathname === '/log') return null; // Hide nav on camera screen

  const navs = [
    { href: '/dashboard', icon: Home, label: 'Home' },
    { href: '/pantry', icon: List, label: 'Pantry' },
    { href: '/log', icon: PlusCircle, label: 'Log', active: true },
    { href: '/social', icon: Search, label: 'Social' },
    { href: '/profile', icon: User, label: 'Me' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-palenight-surface border-t border-white/5 pb-safe pt-2 px-6 z-40 shadow-2xl">
      <div className="flex justify-between items-center h-14">
        {navs.map((n) => {
          const isActive = pathname === n.href;
          const Icon = n.icon;
          return (
            <Link key={n.label} href={n.href} className={`flex flex-col items-center gap-1 ${isActive ? 'text-palenight-accent' : 'text-zinc-500'}`}>
              <Icon size={n.active ? 32 : 24} className={n.active ? 'text-palenight-accent -mt-4 bg-palenight-bg rounded-full p-1 border-4 border-palenight-surface shadow-lg' : ''} />
              <span className="text-[10px] font-medium">{n.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
