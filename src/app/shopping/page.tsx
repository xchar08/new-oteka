'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { shoppingService } from '@/lib/services/shopping.service';
import { pantryService } from '@/lib/services/pantry.service';
import { CheckCircle, Loader2, Plus, ShoppingCart, ChevronLeft, Trash2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/layout/BottomNav';

type ShoppingItem = {
  id: string;
  type: 'db_list' | 'suggestion';
  db_id?: number;
  name: string;
  category: 'Shared List' | 'Pantry Restock' | 'Meal Plan' | 'Smart Suggestion';
  reason: string;
  added_by_name?: string;
  priority?: string;
};

export default function ShoppingPage() {
  const queryClient = useQueryClient();
  const [manualInput, setManualInput] = useState('');
  const supabase = createClient();
  const router = useRouter();

  // 1. Fetch User & Household
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
      return data;
    }
  });

  const householdId = userProfile?.household_id;

  // 2. Fetch Shopping List
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['shopping-list', householdId],
    queryFn: async () => {
      if (!householdId) return [];
      
      const combinedItems: ShoppingItem[] = [];

      // A. Shared List from DB
      const sharedList = await shoppingService.getList(householdId);
      const userIds = Array.from(new Set(sharedList.map((i: any) => i.added_by).filter(Boolean)));
      
      const { data: memberNames } = await supabase
          .from('users')
          .select('id, display_name')
          .in('id', userIds);
      
      const nameMap = Object.fromEntries(memberNames?.map(m => [m.id, m.display_name]) || []);

      sharedList.forEach((item: any) => {
          combinedItems.push({
              id: `list-${item.id}`,
              type: 'db_list',
              db_id: item.id,
              name: item.name,
              category: 'Shared List',
              reason: item.category || 'Manual Add',
              added_by_name: nameMap[item.added_by] || 'Member'
          });
      });

      // B. Low Stock Pantry Suggestions
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
          const pantry = await pantryService.getPantry(user.id);
          const lowStock = pantry.filter((p: any) => p.probability_score < 0.3);
          lowStock.forEach((p: any) => {
            if (combinedItems.some(i => i.name.toLowerCase() === p.foods?.name?.toLowerCase())) return;
            combinedItems.push({
              id: `pantry-${p.id}`,
              type: 'suggestion',
              db_id: p.id,
              name: p.foods?.name || 'Unknown Item',
              category: 'Pantry Restock',
              reason: `Low Stock (${(p.probability_score * 100).toFixed(0)}%)`
            });
          });
      }

      return combinedItems;
    },
    enabled: !!householdId
  });

  // 3. Mutations
  const actionMutation = useMutation({
    mutationFn: async (item: ShoppingItem) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      if (item.type === 'db_list' && item.db_id) {
          await shoppingService.deleteItem(item.db_id);
          // Add to pantry
          await supabase.from('pantry').insert({
            user_id: user.id,
            household_id: householdId,
            name: item.name,
            status: 'active'
          });
          return { name: item.name, action: 'purchased' };
      } else if (item.category === 'Pantry Restock' && item.db_id) {
          await pantryService.verifyItem(item.db_id, 'active');
          return { name: item.name, action: 'restocked' };
      } else {
          await shoppingService.upsertItem({
              household_id: householdId,
              name: item.name,
              added_by: user.id,
          });
          return { name: item.name, action: 'added' };
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
      queryClient.invalidateQueries({ queryKey: ['pantry-items'] });
      toast.success(`${data.name} ${data.action}`);
    }
  });

  const handleManualAdd = async () => {
    if (!manualInput.trim() || !userProfile?.id || !householdId) return;
    
    actionMutation.mutate({
      id: `manual-${Date.now()}`,
      type: 'suggestion',
      name: manualInput.trim(),
      category: 'Shared List',
      reason: 'Manual Add'
    });
    setManualInput('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  const groupedItems = {
    shared: items.filter(i => i.category === 'Shared List'),
    pantry: items.filter(i => i.category === 'Pantry Restock'),
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] p-6 pb-32 flex flex-col gap-6 animate-in fade-in duration-500">
      
      <header className="flex items-center gap-4 pt-safe">
        <button 
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
        >
            <ChevronLeft size={24} />
        </button>
        <div>
           <h1 className="text-3xl font-light tracking-tight mb-1">Shopping</h1>
           <p className="text-[var(--text-secondary)] text-sm">Managed household supply.</p>
        </div>
      </header>

      <div className="relative z-10">
          <input 
            type="text" 
            placeholder="Add to shared list..."
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter') handleManualAdd();
            }}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl h-14 pl-5 pr-14 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--primary)] transition-all shadow-sm"
          />
          <button 
            onClick={handleManualAdd}
            disabled={!manualInput.trim()}
            className="absolute right-3 top-3 h-8 w-8 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center disabled:opacity-30"
          >
              <Plus className="h-5 w-5" />
          </button>
      </div>
       
      <div className="space-y-8 relative z-10">
        {items.length === 0 ? (
          <div className="text-center py-20 bg-[var(--bg-surface)] border border-dashed border-[var(--border)] rounded-[32px]">
            <CheckCircle className="h-10 w-10 mx-auto mb-4 text-[var(--primary)] opacity-20" />
            <p className="text-[var(--text-secondary)] font-medium">Everything is stocked up.</p>
          </div>
        ) : (
            <>
                {groupedItems.shared.length > 0 && (
                    <section>
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-4 ml-1">Shared Household List</h3>
                        <div className="space-y-3">
                            {groupedItems.shared.map(item => (
                                <ShoppingItemRow key={item.id} item={item} onAction={() => actionMutation.mutate(item)} isProcessing={actionMutation.isPending && (actionMutation.variables as any)?.id === item.id} />
                            ))}
                        </div>
                    </section>
                )}

                {groupedItems.pantry.length > 0 && (
                    <section>
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--error)] mb-4 ml-1">Pantry Restock Required</h3>
                        <div className="space-y-3">
                            {groupedItems.pantry.map(item => (
                                <ShoppingItemRow key={item.id} item={item} onAction={() => actionMutation.mutate(item)} isProcessing={actionMutation.isPending && (actionMutation.variables as any)?.id === item.id} />
                            ))}
                        </div>
                    </section>
                )}
            </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

function ShoppingItemRow({ item, onAction, isProcessing }: { item: ShoppingItem; onAction: () => void; isProcessing: boolean }) {
    return (
        <motion.div 
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center justify-between p-4 rounded-2xl border bg-[var(--bg-surface)] border-[var(--border)] shadow-sm group`}
        >
            <div className="flex-1 min-w-0 mr-4">
                <div className="font-bold text-[var(--text-primary)] text-base truncate capitalize">{item.name}</div>
                <div className="flex items-center gap-2 mt-1">
                   <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider font-bold">{item.reason}</div>
                   {item.added_by_name && (
                       <>
                        <div className="w-1 h-1 bg-[var(--border)] rounded-full" />
                        <div className="text-[9px] text-[var(--primary)] uppercase tracking-wider font-black">By {item.added_by_name}</div>
                       </>
                   )}
                </div>
            </div>
            <button 
                onClick={onAction}
                disabled={isProcessing}
                className="w-12 h-12 rounded-xl bg-[var(--bg-app)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--primary)] hover:text-white transition-all active:scale-90"
            >
                {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : <Plus size={22} />}
            </button>
        </motion.div>
    );
}
