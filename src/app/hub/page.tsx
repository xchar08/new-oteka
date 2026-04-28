'use client';

import { motion } from 'framer-motion';
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
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};

const HUB_GROUPS = [
  {
    title: 'Planning',
    items: [
      { name: 'Meal Planner', href: '/planner', icon: Calendar, color: 'text-blue-400', bg: 'bg-blue-500/10' },
      { name: 'Shopping List', href: '/shopping', icon: ShoppingCart, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    ]
  },
  {
    title: 'Tools',
    items: [
      { name: 'Menu Scanner', href: '/travel/menu', icon: Plane, color: 'text-purple-400', bg: 'bg-purple-500/10' },
      { name: 'Offline Log', href: '/log/offline', icon: Activity, color: 'text-zinc-400', bg: 'bg-zinc-500/10' },
    ]
  },
  {
    title: 'Insights & Community',
    items: [
      { name: 'Analytics', href: '/analytics', icon: TrendingUp, color: 'text-orange-400', bg: 'bg-orange-500/10' },
      { name: 'History', href: '/history', icon: History, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
      { name: 'Household', href: '/social', icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
      { name: 'AI Coach', href: '/coach', icon: MessageSquare, color: 'text-pink-400', bg: 'bg-pink-500/10' },
    ]
  },
  {
    title: 'System',
    items: [
      { name: 'Workflows', href: '/workflows', icon: Workflow, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
      { name: 'Premium', href: '/pricing', icon: Activity, color: 'text-lime-400', bg: 'bg-lime-500/10' },
      { name: 'Nutrition Guide', href: '/about', icon: ChefHat, color: 'text-zinc-400', bg: 'bg-zinc-500/10' },
    ]
  }
];

export default function HubPage() {
  return (
    <div className="min-h-screen bg-zinc-950 pb-32 text-white">
      <header className="pt-safe px-6 pb-6 bg-gradient-to-b from-zinc-900/50 to-transparent">
        <h1 className="text-3xl font-light tracking-tight mt-6">Control Center</h1>
        <p className="text-zinc-500 text-sm mt-1">Manage your metabolic journey</p>
      </header>

      <motion.main 
        variants={container}
        initial="hidden"
        animate="show"
        className="px-6 space-y-8 mt-4"
      >
        {HUB_GROUPS.map((group) => (
          <div key={group.title} className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-600 px-1">{group.title}</h2>
            <div className="grid grid-cols-2 gap-4">
              {group.items.map((hubItem) => (
                <motion.div key={hubItem.name} variants={item}>
                  <Link 
                    href={hubItem.href}
                    className="flex flex-col p-4 rounded-2xl bg-zinc-900/40 border border-white/5 backdrop-blur-sm active:scale-95 transition-all duration-200 group"
                  >
                    <div className={`w-10 h-10 ${hubItem.bg} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                      <hubItem.icon className={hubItem.color} size={20} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-300">{hubItem.name}</span>
                      <ArrowRight size={14} className="text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </motion.main>
    </div>
  );
}
