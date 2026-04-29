'use client';

import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  ChevronRight, 
  Menu,
  ShoppingBag,
  Package,
  ArrowRight,
  UtensilsCrossed,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BottomNav } from '@/components/layout/BottomNav';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { type: 'spring', stiffness: 120 }
  }
};

const pantryCategories = ['All', 'Grains', 'Proteins', 'Produce', 'Dairy', 'Snacks'];

export default function PantryPage() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const { pantryItems, user, loading } = useDashboardData();
  const router = useRouter();
  const supabase = createClient();

  const handleAddMeal = async (item: any) => {
    const food = item.foods || {};
    const meta = item.metadata_json || {};
    
    const { error } = await supabase.from('logs').insert({
        user_id: user.id,
        grams: 100, // Default portion
        metabolic_tags_json: {
            food_name: item.name || food.name,
            calories: (food.nutritional_info?.calories || 0),
            protein: (food.nutritional_info?.protein || 0),
            carbs: (food.nutritional_info?.carbs || 0),
            fats: (food.nutritional_info?.fats || 0),
            ingredients: meta.ingredients || []
        }
    });

    if (!error) {
        toast.success(`Logged 100g of ${item.name || food.name}`);
        router.push('/log');
    } else {
        toast.error("Failed to log meal");
    }
  };

  const filteredItems = pantryItems.filter(item => {
    const itemCat = item.metadata_json?.category || 'Grocery';
    const matchesCategory = activeCategory === 'All' || itemCat === activeCategory;
    const matchesSearch = (item.name || item.foods?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] pb-32 font-sans overflow-x-hidden transition-colors duration-500">
      {/* Top App Bar */}
      <motion.header 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="px-6 pt-8 pb-4 flex justify-between items-center bg-[var(--bg-app)]/80 backdrop-blur-md sticky top-0 z-40"
      >
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tight">Pantry</h1>
        </div>
        <div className="flex items-center gap-3">
            <motion.button 
                onClick={() => router.push('/shopping')}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--bg-surface)] shadow-sm border border-[var(--border)]"
            >
                <ShoppingBag size={20} className="text-[var(--primary)]" />
            </motion.button>
            <motion.div 
                onClick={() => router.push('/profile')}
                whileHover={{ scale: 1.1 }}
                className="w-10 h-10 rounded-xl overflow-hidden border-2 border-[var(--primary)]/20 shadow-sm bg-[var(--bg-surface)] flex items-center justify-center cursor-pointer"
            >
                {user?.avatar_url ? (
                <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                <User size={20} className="text-[var(--text-secondary)]" />
                )}
            </motion.div>
        </div>
      </motion.header>

      {/* Search Bar */}
      <section className="px-6 py-6">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="relative"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-40" size={20} />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ingredients..." 
            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-[var(--primary)] transition-colors shadow-sm"
          />
        </motion.div>
      </section>

      {/* Categories Chips */}
      <section className="px-6 mb-8 overflow-x-auto scrollbar-hide">
        <motion.div 
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex gap-2"
        >
          {pantryCategories.map((cat) => (
            <motion.button 
              key={cat} 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveCategory(cat)}
              className={`px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                activeCategory === cat 
                ? 'bg-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/20' 
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border)] shadow-sm'
              }`}
            >
              {cat}
            </motion.button>
          ))}
        </motion.div>
      </section>

      {/* Pantry List */}
      <motion.section 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="px-6 space-y-4"
      >
        <AnimatePresence mode="popLayout">
          {filteredItems.length === 0 ? (
             <div className="text-center py-20 bg-[var(--bg-surface)] rounded-[32px] border border-dashed border-[var(--border)]">
                <Package className="mx-auto text-[var(--text-secondary)] opacity-20 mb-4" size={48} />
                <p className="text-[var(--text-secondary)] opacity-50 font-medium">No ingredients found</p>
             </div>
          ) : filteredItems.map((item) => (
            <motion.div 
              key={item.id} 
              variants={itemVariants}
              layout
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-[var(--bg-surface)] rounded-[28px] p-4 flex items-center gap-4 shadow-sm border border-[var(--border)] group"
            >
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[var(--bg-app)] border border-[var(--border)] shadow-inner shrink-0 flex items-center justify-center">
                {item.metadata_json?.image_url ? (
                   <img src={item.metadata_json.image_url} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                   <UtensilsCrossed size={24} className="text-[var(--text-secondary)] opacity-20" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-[var(--text-primary)] truncate capitalize">{item.name || item.foods?.name}</h4>
                <div className="flex items-center gap-2 mt-1">
                   <span className="text-[10px] font-bold uppercase text-[var(--primary)] tracking-wider">{item.metadata_json?.category || 'Grocery'}</span>
                   <span className="w-1 h-1 bg-[var(--border)] rounded-full"></span>
                   <span className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40 uppercase">{(item.foods?.nutritional_info?.calories || 0)} kcal/100g</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <motion.button 
                  onClick={() => handleAddMeal(item)}
                  whileHover={{ scale: 1.1, backgroundColor: 'var(--primary)', color: '#fff' }}
                  whileTap={{ scale: 0.9 }}
                  className="w-10 h-10 rounded-xl bg-[var(--bg-app)] border border-[var(--border)] flex items-center justify-center text-[var(--primary)]"
                >
                  <Plus size={20} strokeWidth={2.5} />
                </motion.button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.section>

      {/* Bottom Action Card */}
      <section className="px-6 mt-12 mb-8">
        <motion.div 
          onClick={() => router.push('/shopping')}
          whileHover={{ y: -5 }}
          className="bg-[var(--secondary)] rounded-[32px] p-8 text-white relative overflow-hidden shadow-2xl cursor-pointer"
        >
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-[var(--primary)]/20 rounded-full blur-3xl" />
          <h3 className="text-xl font-bold mb-2">Need a Shopping List?</h3>
          <p className="text-sm opacity-60 mb-6 max-w-[200px]">Let Oteka AI generate your weekly supply based on your metabolic goals.</p>
          <motion.div 
            whileHover={{ x: 5 }}
            className="flex items-center gap-2 text-[var(--primary)] font-bold uppercase tracking-widest text-xs"
          >
            Generate List <ArrowRight size={16} />
          </motion.div>
        </motion.div>
      </section>

      {/* Floating Action Button */}
      <motion.button 
        onClick={() => router.push('/vision')}
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 10, stiffness: 200, delay: 0.5 }}
        className="fixed bottom-24 right-6 w-16 h-16 bg-[var(--primary)] text-white rounded-2xl shadow-2xl shadow-[var(--primary)]/40 flex items-center justify-center z-50"
      >
        <Plus size={36} strokeWidth={3} />
      </motion.button>

      <BottomNav />
    </div>
  );
}
