'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Play, Plus, Clock, Activity, MoreHorizontal, CheckCircle2, XCircle, Menu, Bell, Zap, Sparkles, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BottomNav } from '@/components/layout/BottomNav';
import { useRouter } from 'next/navigation';

type Workflow = {
    id: number;
    name: string;
    trigger_type: 'schedule' | 'event' | 'webhook';
    definition_json: any;
    is_active: boolean;
    last_run_at: string | null;
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: 'spring', stiffness: 100 }
  }
};

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('workflows')
        .select('*')
        .eq('user_id', user.id)
        .order('id', { ascending: false });
        
      setWorkflows(data || []);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const toggleActive = async (id: number, current: boolean) => {
      setWorkflows(prev => prev.map(w => w.id === id ? { ...w, is_active: !current } : w));
      const { error } = await supabase
        .from('workflows')
        .update({ is_active: !current })
        .eq('id', id);

      if (error) {
          setWorkflows(prev => prev.map(w => w.id === id ? { ...w, is_active: current } : w));
          console.error(error);
      }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] pb-32 font-sans overflow-x-hidden transition-colors duration-500">
        {/* Top App Bar */}
        <motion.header 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="px-6 pt-8 pb-4 flex justify-between items-center bg-[var(--bg-app)]/80 backdrop-blur-md sticky top-0 z-40 border-b border-[var(--border)]"
        >
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] shadow-sm">
                <ChevronLeft size={24} />
            </button>
            <h1 className="text-2xl font-black tracking-tight">Automation</h1>
          </div>
          <div className="flex items-center gap-3">
            <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--bg-surface)] shadow-sm border border-[var(--border)]"
            >
                <Zap size={20} className="text-[var(--primary)]" />
            </motion.button>
          </div>
        </motion.header>

        <main className="px-6 py-8 space-y-8">
            <div className="flex justify-between items-end px-1">
                <div>
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-secondary)] mb-1">Background Agents</h2>
                    <p className="text-sm text-[var(--text-primary)] opacity-60 font-medium">Manage metabolic AI routines.</p>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-[var(--secondary)] text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg"
                >
                    <Plus size={14} strokeWidth={4} /> New Agent
                </motion.button>
            </div>

            {loading ? (
                 <div className="space-y-4">
                     {[1,2,3].map(i => (
                         <div key={i} className="h-24 bg-[var(--bg-surface)] rounded-[32px] animate-pulse border border-[var(--border)]" />
                     ))}
                 </div>
            ) : workflows.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-20 bg-[var(--bg-surface)] border border-dashed border-[var(--border)] rounded-[40px] shadow-sm"
                >
                    <div className="w-20 h-20 bg-[var(--bg-app)] rounded-[28px] flex items-center justify-center mx-auto mb-6 border border-[var(--border)] shadow-inner">
                        <Sparkles className="text-[var(--primary)] h-10 w-10 opacity-20" />
                    </div>
                    <h3 className="text-xl font-black text-[var(--text-primary)]">No active agents</h3>
                    <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-xs mx-auto font-medium px-4 leading-relaxed">Create biological triggers to automate pantry logistics or insight extraction.</p>
                </motion.div>
            ) : (
                <motion.div 
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid gap-4"
                >
                    {workflows.map(workflow => (
                        <motion.div 
                            variants={itemVariants}
                            key={workflow.id}
                            className="bg-[var(--bg-surface)] rounded-[32px] p-5 flex items-center justify-between group shadow-sm border border-[var(--border)]"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-colors ${workflow.is_active ? 'bg-[var(--primary)]/10 border-[var(--primary)]/20 text-[var(--primary)]' : 'bg-[var(--bg-app)] border-[var(--border)] text-[var(--text-secondary)]'}`}>
                                    {workflow.trigger_type === 'schedule' ? <Clock size={24} /> : <Activity size={24} />}
                                </div>
                                <div>
                                    <h3 className={`font-black text-lg ${workflow.is_active ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                                        {workflow.name}
                                    </h3>
                                    <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60 mt-1">
                                        <span className="bg-[var(--bg-app)] px-2 py-0.5 rounded-lg border border-[var(--border)]">
                                            {workflow.trigger_type}
                                        </span>
                                        {workflow.last_run_at && (
                                            <span>Ran {new Date(workflow.last_run_at).toLocaleDateString()}</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                 <motion.button 
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => toggleActive(workflow.id, workflow.is_active)}
                                    className={`text-[9px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl border transition-all ${
                                        workflow.is_active 
                                        ? 'bg-[var(--primary)] text-white border-transparent shadow-lg shadow-[var(--primary)]/30' 
                                        : 'bg-[var(--bg-app)] text-[var(--text-secondary)] border-[var(--border)]'
                                    }`}
                                 >
                                    {workflow.is_active ? 'Active' : 'Paused'}
                                 </motion.button>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            )}

            {/* Neural Sync Status */}
            <section className="bg-[var(--secondary)] rounded-[40px] p-8 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Zap size={140} strokeWidth={1} />
                </div>
                <div className="relative z-10">
                    <h3 className="text-xl font-black mb-2 italic tracking-tight text-[var(--primary)]">Neural Node Active</h3>
                    <p className="text-sm text-white/60 mb-8 max-w-[220px] font-medium leading-relaxed">
                        Agents operate on the Oteka Neural Network to maintain 24/7 metabolic synchronization.
                    </p>
                    <div className="flex items-center gap-2 text-[var(--primary)] font-black uppercase tracking-[0.3em] text-[9px] bg-white/5 w-fit px-4 py-2 rounded-full border border-white/5">
                        Latency: 42ms <CheckCircle2 size={12} />
                    </div>
                </div>
            </section>
        </main>

        <BottomNav />
    </div>
  );
}
