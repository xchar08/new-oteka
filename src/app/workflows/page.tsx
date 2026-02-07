'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Play, Plus, Clock, Activity, MoreHorizontal, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

type Workflow = {
    id: number;
    name: string;
    trigger_type: 'schedule' | 'event' | 'webhook';
    definition_json: any;
    is_active: boolean;
    last_run_at: string | null;
};

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
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
  }, []);

  const toggleActive = async (id: number, current: boolean) => {
      // Optimistic
      setWorkflows(prev => prev.map(w => w.id === id ? { ...w, is_active: !current } : w));
      
      const { error } = await supabase
        .from('workflows')
        .update({ is_active: !current })
        .eq('id', id);

      if (error) {
          // Revert
          setWorkflows(prev => prev.map(w => w.id === id ? { ...w, is_active: current } : w));
          console.error(error);
      }
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-6 pb-32 text-zinc-100 space-y-8 animate-in fade-in duration-500">
        <div className="fixed top-0 right-0 w-[50vw] h-[50vh] bg-blue-900/10 blur-[120px] pointer-events-none" />

        <header className="pt-safe flex justify-between items-end relative z-10">
            <div>
                <h1 className="text-3xl font-light tracking-tight text-white mb-1">Automation</h1>
                <p className="text-zinc-500 text-sm">Manage background agents & triggers</p>
            </div>
            <Button className="bg-white text-black hover:bg-zinc-200">
                <Plus size={16} className="mr-2" /> New Workflow
            </Button>
        </header>

        {loading ? (
             <div className="space-y-4">
                 {[1,2,3].map(i => (
                     <div key={i} className="h-24 bg-white/5 rounded-2xl animate-pulse" />
                 ))}
             </div>
        ) : workflows.length === 0 ? (
            <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/5">
                <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-800">
                    <Activity className="text-zinc-600" />
                </div>
                <h3 className="text-lg font-medium text-white">No active workflows</h3>
                <p className="text-zinc-500 mt-2 max-w-xs mx-auto">Create automations to handle pantry refills, summary emails, or smart home triggers.</p>
            </div>
        ) : (
            <div className="grid gap-4 relative z-10">
                {workflows.map(workflow => (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={workflow.id}
                        className="bg-white/5 border border-white/5 p-5 rounded-2xl backdrop-blur-md flex items-center justify-between group hover:bg-white/10 transition-all"
                    >
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${workflow.is_active ? 'bg-blue-500/10 text-blue-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                {workflow.trigger_type === 'schedule' ? <Clock size={20} /> : <Activity size={20} />}
                            </div>
                            <div>
                                <h3 className={`font-medium text-lg ${workflow.is_active ? 'text-white' : 'text-zinc-400'}`}>
                                    {workflow.name}
                                </h3>
                                <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                                    <span className="bg-white/5 px-2 py-0.5 rounded capitalize border border-white/5">
                                        {workflow.trigger_type}
                                    </span>
                                    {workflow.last_run_at && (
                                        <span>Last run: {new Date(workflow.last_run_at).toLocaleDateString()}</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                             <button 
                                onClick={() => toggleActive(workflow.id, workflow.is_active)}
                                className={`text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                                    workflow.is_active 
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' 
                                    : 'bg-zinc-800 text-zinc-400 border-transparent hover:text-zinc-200'
                                }`}
                             >
                                {workflow.is_active ? 'Active' : 'Paused'}
                             </button>
                             <Button size="sm" variant="ghost" className="text-zinc-500 hover:text-white px-2">
                                 <MoreHorizontal size={20} />
                             </Button>
                        </div>
                    </motion.div>
                ))}
            </div>
        )}
    </div>
  );
}
