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
    <nav className="fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-xl border-t border-border pb-safe pt-2 px-6 z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
      <div className="flex justify-around items-end h-16 max-w-md mx-auto relative">
        {navs.map((n) => {
          const isActive = pathname === n.href;
          const isMainAction = n.active; // The Log button
          const Icon = n.icon;
          
          // Standard inline rendering for all items
          return (
            <Link 
              key={n.label} 
              href={n.href} 
              className={`flex flex-col items-center gap-1 transition-all duration-300 ${isActive ? 'text-primary scale-110' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <div className={`p-1 rounded-xl transition-colors ${isActive ? 'bg-primary/10' : 'bg-transparent'}`}>
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>{n.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
