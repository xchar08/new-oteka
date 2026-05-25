'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  Package,
  ArrowRight,
  UtensilsCrossed,
  User,
  Target,
  ShoppingCart,
  ShoppingBag,
  Loader2,
  WifiOff,
  XCircle,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { BottomNav } from '@/components/layout/BottomNav';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { visionService } from '@/lib/services/vision.service';
import { ReviewNeededCard } from '@/components/pantry/ReviewNeededCard';
import { PlannerControls, PlannerConstraints } from '@/components/planner/PlannerControls';
import { PricingGuard } from '@/components/ui/PricingGuard';
import { runOptimization } from '@/lib/engine/planner/runOptimization';
import { userService } from '@/lib/services/user.service';
import { pantryService } from '@/lib/services/pantry.service';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
};

const itemVariants: Variants = {
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
  const [mounted, setMounted] = useState(false);
  const { pantryItems, user, loading, isOnline, activeConditions, globalFoods } = useDashboardData();
  const router = useRouter();
  const supabase = createClient();

  // Manual add state
  const [addQuery, setAddQuery] = useState('');
  const [foodSearchResults, setFoodSearchResults] = useState<any[]>([]);
  const [addingItem, setAddingItem] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Planner state
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [planLoading, setPlanLoading] = useState(false);
  const [planStatus, setPlanStatus] = useState('');
  const [planError, setPlanError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // --- MEAL LOGGING ---
  const handleAddMeal = async (item: any) => {
    if (!user) return;
    const food = item.foods || {};
    const meta = item.metadata_json || {};

    const category = meta.category || 'Grocery';
    let defaultGrams = 100;
    
    // Updated based on RFK Jr / MAHA 2025-2030 Food Guidelines (Inverted Pyramid)
    if (['Meat', 'Proteins', 'Fish', 'Poultry', 'Beef'].some(c => category.includes(c))) defaultGrams = 200; // Increased protein emphasis
    else if (['Dairy', 'Milk', 'Cheese'].some(c => category.includes(c))) defaultGrams = 150; // Full-fat dairy emphasis
    else if (['Produce', 'Vegetables', 'Fruits'].some(c => category.includes(c))) defaultGrams = 150;
    else if (['Oils', 'Fats', 'Butter', 'Tallow'].some(c => category.includes(c))) defaultGrams = 15; // Healthy fats (keep volume small due to density)
    else if (['Grains', 'Carbs', 'Bread'].some(c => category.includes(c))) defaultGrams = 50; // Minimized grains at the bottom of pyramid
    else if (['Snacks', 'Sweets', 'Processed'].some(c => category.includes(c))) defaultGrams = 30;

    // Scale macros based on defaultGrams (assuming DB stores values per 100g)
    const scale = defaultGrams / 100;

    try {
      await visionService.logMeal(user.id, {
        grams: defaultGrams,
        name: item.name || food.name,
        calories: (food.nutritional_info?.calories || 0) * scale,
        protein: (food.nutritional_info?.protein || 0) * scale,
        carbs: (food.nutritional_info?.carbs || 0) * scale,
        fats: (food.nutritional_info?.fats || 0) * scale,
        ingredients: meta.ingredients || []
      });

      toast.success(`Logged ${defaultGrams}g of ${item.name || food.name}`);
      router.push('/log');
    } catch (err) {
      toast.error("Failed to log meal");
    }
  };

  // --- REVIEW NEEDED (Ghost Check) ---
  const reviewNeededItems = pantryItems.filter(
    (item: any) => item.probability_score != null && item.probability_score < 0.3 && item.status !== 'consumed'
  );

  const handleConfirmGood = async (pantryId: number, fraction: number, currentMetadata: any) => {
    try {
      await pantryService.verifyItem(pantryId, 'active', currentMetadata || {}, fraction);
      toast.success(`Item stock updated to ${fraction * 100}%.`);
    } catch {
      toast.error('Failed to update item.');
    }
  };

  const handleConfirmSpoiled = async (pantryId: number) => {
    try {
      await pantryService.verifyItem(pantryId, 'consumed');
      toast.success('Item marked as depleted.');
    } catch {
      toast.error('Failed to update item.');
    }
  };

  // --- PLANNER ---
  const handleRun = async (constraints: PlannerConstraints) => {
    setPlanLoading(true);
    setPlanStatus('Analyzing Metabolism...');
    setPlanError(null);
    setPlans([]);
    
    try {
      if (isOnline) {
        setPlanStatus('Optimizing Nutrients (Cloud)...');
        const { data, error } = await supabase.functions.invoke('optimize-meals', {
          body: {
            constraints: {
              ...constraints,
              pop_size: 50,
              generations: 30
            }
          }
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Optimization failed.");
        setPlans(data.solutions || []);
      } else {
        setPlanStatus('Optimizing Nutrients (Local)...');
        const conditionObjects = activeConditions.map(name => ({ name, rules_json: {} }));
        
        const result: any = await runOptimization({
          pantry_items: pantryItems,
          user_profile: user,
          conditions: conditionObjects,
          constraints,
          global_foods: globalFoods
        });
        setPlans(result.solutions || []);
      }
      
      setPlanStatus('Optimal compositions found.');
      
    } catch (err: any) {
      console.error("[Planner] Optimization Failed:", err);
      setPlanError(err.message || "Failed to run metabolic optimization.");
      setPlanStatus('');
    } finally {
      setPlanLoading(false);
    }
  };

  const handleDislikeItem = async (itemName: string) => {
    if (!user) return;
    try {
        toast.promise(userService.addRestriction(user.id, itemName), {
            loading: `Adding ${itemName} to exclusions...`,
            success: `${itemName} will no longer be suggested.`,
            error: `Failed to update exclusions.`
        });
    } catch (err) {
        console.error("Dislike failed:", err);
    }
  };

  // --- MANUAL PANTRY ADD ---
  const handleFoodSearch = useCallback((query: string) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!query || query.trim().length < 2) {
      setFoodSearchResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await pantryService.searchFoods(query.trim());
        setFoodSearchResults(results);
      } catch {
        setFoodSearchResults([]);
      }
    }, 300); // 300ms debounce
  }, []);

  const handleManualPantryAdd = async (name: string, foodId?: number) => {
    if (!user || addingItem) return;
    setAddingItem(true);
    try {
      await pantryService.addItem(user.id, user.household_id || null, name, foodId);
      toast.success(`Added ${name} to pantry`);
      setAddQuery('');
      setFoodSearchResults([]);
      // Refresh pantry list
      window.location.reload();
    } catch (err) {
      toast.error('Failed to add item to pantry');
    } finally {
      setAddingItem(false);
    }
  };

  // --- FILTERING ---
  const filteredItems = pantryItems.filter((item: any) => {
    const itemCat = item.metadata_json?.category || 'Grocery';
    const matchesCategory = activeCategory === 'All' || itemCat === activeCategory;
    const matchesSearch = (item.name || item.foods?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (loading || !mounted) {
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
          <h1 className="text-2xl font-black tracking-tight">Pantry Core</h1>
        </div>
        <div className="flex items-center gap-3">
            {!isOnline && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-500/10 text-orange-500 border border-orange-500/20">
                  <WifiOff size={10} />
                  <span className="text-[8px] font-black uppercase tracking-widest">Offline</span>
              </div>
            )}
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

      {/* Review Needed (Ghost Check) Section */}
      {reviewNeededItems.length > 0 && (
        <section className="px-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-[var(--primary)] shadow-[0_0_8px_var(--primary)] animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--primary)]">
              Verify {reviewNeededItems.length} Item{reviewNeededItems.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-3">
            {reviewNeededItems.map((item: any) => (
              <ReviewNeededCard
                key={item.id}
                id={item.id}
                name={item.name || item.foods?.name || 'Unknown'}
                probability={item.probability_score}
                onConfirmGood={(fraction) => handleConfirmGood(item.id, fraction, item.metadata_json)}
                onConfirmSpoiled={() => handleConfirmSpoiled(item.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Search + Manual Add */}
      <section className="px-6 py-6 space-y-3">
        {/* Search existing pantry */}
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
            placeholder="Search pantry..." 
            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-[var(--primary)] transition-colors shadow-sm font-medium"
          />
        </motion.div>

        {/* Manual Add with autocomplete */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="relative"
        >
          <Plus className="absolute left-4 top-4 text-[var(--primary)] opacity-60" size={20} />
          <input 
            type="text" 
            value={addQuery}
            onChange={(e) => {
              setAddQuery(e.target.value);
              handleFoodSearch(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && addQuery.trim()) {
                handleManualPantryAdd(addQuery.trim());
              }
            }}
            placeholder="Add food to pantry..." 
            className="w-full bg-[var(--bg-surface)] border border-[var(--primary)]/30 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-[var(--primary)] transition-colors shadow-sm font-medium"
          />
          
          {/* Autocomplete dropdown */}
          <AnimatePresence>
            {foodSearchResults.length > 0 && addQuery.length >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute top-full left-0 right-0 z-50 mt-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden max-h-[240px] overflow-y-auto"
              >
                {foodSearchResults.map((food: any) => (
                  <button
                    key={food.id}
                    onClick={() => handleManualPantryAdd(food.name, food.id)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--primary)]/5 transition-colors text-left border-b border-[var(--border)]/30 last:border-b-0"
                  >
                    <div>
                      <span className="font-bold text-sm capitalize text-[var(--text-primary)]">{food.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] font-bold text-[var(--primary)] uppercase tracking-wider">
                          {food.nutritional_info?.calories || 0} kcal
                        </span>
                        <span className="w-1 h-1 bg-[var(--border)] rounded-full" />
                        <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                          {food.nutritional_info?.protein || 0}g protein
                        </span>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
                      <Plus size={16} className="text-[var(--primary)]" />
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
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
              className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
                activeCategory === cat 
                ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-lg shadow-[var(--primary)]/20' 
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border)] opacity-60'
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
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50">Inventory Empty</p>
             </div>
          ) : filteredItems.map((item: any) => (
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
                   <span className="w-1 h-1 bg-[var(--border)] rounded-full opacity-30"></span>
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

      {/* Integrated AI Planner Section */}
      <section className="px-6 mt-12 space-y-4 mb-8">
        <PricingGuard plan={user?.plan} featureName="Meal Planner">
          <motion.div
            whileHover={{ y: -3 }}
            className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary)]/80 rounded-[32px] p-6 text-white relative overflow-hidden shadow-xl cursor-pointer group"
            onClick={() => setPlannerOpen(!plannerOpen)}
          >
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all" />
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                  <Target size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">AI Meal Planner</h3>
                  <p className="text-[10px] opacity-60 font-bold uppercase tracking-tight">
                    {pantryItems.length} items in pool • {isOnline ? 'Cloud' : 'Local'} Engine
                  </p>
                </div>
              </div>
              <motion.div animate={{ rotate: plannerOpen ? 180 : 0 }} transition={{ duration: 0.3 }}>
                <ChevronDown size={20} className="text-white/60" />
              </motion.div>
            </div>
          </motion.div>
        </PricingGuard>

        <AnimatePresence>
          {plannerOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 25 }}
              className="overflow-hidden"
            >
              <div className="space-y-4 pt-2">
                {/* Planner Controls */}
                <PlannerControls onRun={handleRun} />

                {/* Error */}
                {planError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl text-sm font-medium">
                    {planError}
                  </div>
                )}

                {/* Loading */}
                {planLoading && (
                  <div className="flex flex-col items-center justify-center p-12 space-y-4 text-[var(--text-secondary)]">
                    <div className="h-16 w-16 rounded-3xl bg-[var(--primary)]/10 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest">{planStatus}</span>
                  </div>
                )}

                {/* Plan Results */}
                <div className="space-y-4">
                  {plans.map((plan, i) => (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={i} 
                        className="group relative border border-[var(--border)] p-6 rounded-[28px] bg-[var(--bg-surface)] overflow-hidden shadow-sm"
                    >
                      <div className="flex justify-between items-start mb-6 relative z-10">
                         <div className="flex items-center gap-3">
                             <div className="h-10 w-10 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
                                 <span className="font-black text-sm">{String.fromCharCode(65 + i)}</span>
                             </div>
                             <h3 className="font-black text-[var(--text-primary)]">Composition {i + 1}</h3>
                         </div>
                         <span className="bg-[var(--bg-app)] text-[var(--primary)] text-xs px-4 py-1.5 rounded-full font-bold border border-[var(--border)]">
                            {Math.round(plan.stats.calories)} kcal
                         </span>
                      </div>
                      
                      <div className="space-y-4 relative z-10 mb-6">
                        {plan.menu.map((item: string, idx: number) => (
                          <div key={idx} className="flex items-center justify-between gap-4 group/item">
                            <div className="flex items-center gap-4">
                                <div className="w-2 h-2 bg-[var(--primary)] rounded-full group-hover/item:scale-150 transition-transform" />
                                <span className="text-sm font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">{item}</span>
                            </div>
                            <button 
                                onClick={() => handleDislikeItem(item)}
                                className="opacity-0 group-hover/item:opacity-40 hover:!opacity-100 transition-all p-1"
                                title="Never suggest this again"
                            >
                                <XCircle size={14} className="text-red-500" />
                            </button>
                          </div>
                        ))}
                      </div>
                      
                      {plan.personalized_note && (
                         <div className="text-xs text-[var(--text-secondary)] bg-[var(--bg-app)] p-4 rounded-2xl border border-[var(--border)] leading-relaxed relative z-10 italic">
                            <div className="flex items-center gap-2 mb-2 not-italic">
                                <Sparkles size={12} className="text-[var(--primary)]" />
                                <span className="font-bold uppercase tracking-widest text-[9px] text-[var(--primary)]">Metabolic Advisor</span>
                            </div>
                            &quot;{plan.personalized_note}&quot;
                         </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Shopping CTA */}
        <motion.div 
          onClick={() => router.push('/shopping')}
          whileHover={{ y: -5, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[32px] p-6 relative overflow-hidden shadow-sm cursor-pointer group"
        >
          <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-[var(--primary)]/5 rounded-full blur-2xl group-hover:bg-[var(--primary)]/10 transition-all" />
          <div className="flex items-center gap-3 mb-4">
             <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center">
                <ShoppingCart size={20} className="text-[var(--primary)]" />
             </div>
             <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-primary)]">Smart Logistics</h3>
                <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-tight opacity-40">Shopping Generation</p>
             </div>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-6 font-medium">Detect metabolic supply gaps and generate a synchronized household shopping list.</p>
          <div className="flex items-center gap-2 text-[var(--primary)] font-black uppercase tracking-[0.2em] text-[10px]">
            Generate List <ArrowRight size={14} />
          </div>
        </motion.div>
      </section>

      {/* Floating Action Button */}
      <motion.button 
        onClick={() => router.push('/pantry/scan')}
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
