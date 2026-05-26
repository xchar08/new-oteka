'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Users, UserPlus, Copy, Check, LogOut, ChevronLeft, Home, Flame, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { BottomNav } from '@/components/layout/BottomNav';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: { type: 'spring', stiffness: 100 }
  }
} as const;

export default function HouseholdPage() {
    const router = useRouter();
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [household, setHousehold] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [joinCode, setJoinCode] = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        fetchHouseholdData();
    }, []);

    async function fetchHouseholdData() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: userData } = await supabase
            .from('users')
            .select('household_id, households(*)')
            .eq('id', user.id)
            .single();

        if (userData?.households) {
            setHousehold(userData.households);
            const { data: memberData } = await supabase
                .from('users')
                .select('id, display_name, streak_count, avatar_url')
                .eq('household_id', userData.household_id);
            setMembers(memberData || []);
        }
        setLoading(false);
    }

    const handleCopyCode = () => {
        if (!household?.join_code) return;
        navigator.clipboard.writeText(household.join_code);
        setCopied(true);
        toast.success("Join code copied!");
        setTimeout(() => setCopied(false), 2000);
    };

    const handleJoinHousehold = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinCode.trim()) return;
        
        setIsJoining(true);
        try {
            const { data: targetHouse, error: houseError } = await supabase
                .from('households')
                .select('id, name')
                .eq('join_code', joinCode.trim().toLowerCase())
                .single();

            if (houseError || !targetHouse) {
                toast.error("Invalid join code.");
                return;
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error: updateError } = await supabase
                .from('users')
                .update({ household_id: targetHouse.id })
                .eq('id', user.id);

            if (updateError) throw updateError;

            toast.success(`Welcome to ${targetHouse.name}!`);
            setJoinCode('');
            fetchHouseholdData();
        } catch (err) {
            toast.error("Failed to join.");
        } finally {
            setIsJoining(false);
        }
    };

    const handleLeaveHousehold = async () => {
        if (!confirm("Are you sure? You will be moved to a private household.")) return;
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        try {
            const { data: newHouse } = await supabase
                .from('households')
                .insert({ name: `${user.email?.split('@')[0]}'s House` })
                .select()
                .single();
            
            if (newHouse) {
                await supabase
                    .from('users')
                    .update({ household_id: newHouse.id })
                    .eq('id', user.id);
                
                toast.success("Moved to private household.");
                fetchHouseholdData();
            }
        } catch (err) {
            toast.error("Failed to leave.");
        }
    };

    if (loading) {
        return (
          <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
             <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
          </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] pb-32 font-sans overflow-x-hidden transition-colors">
            {/* Header */}
            <motion.header 
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="px-6 pt-12 pb-8 bg-gradient-to-b from-[var(--primary)]/10 to-transparent rounded-b-[40px]"
            >
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="w-10 h-10 bg-[var(--bg-surface)] rounded-xl flex items-center justify-center shadow-sm border border-[var(--primary)]/10 text-[var(--text-secondary)]">
                            <ChevronLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight">Household</h1>
                            <p className="text-[var(--text-secondary)] text-[10px] font-bold uppercase tracking-widest opacity-60">Shared Vitality</p>
                        </div>
                    </div>
                    <div className="w-12 h-12 bg-[var(--bg-surface)] border border-[var(--primary)]/10 rounded-2xl flex items-center justify-center text-[var(--primary)] shadow-xl shadow-[var(--primary)]/10">
                        <Home size={24} />
                    </div>
                </div>
            </motion.header>

            <motion.main 
                variants={container}
                initial="hidden"
                animate="show"
                className="px-6 -mt-4 space-y-6"
            >
                {/* Current Household Status */}
                <motion.div variants={item} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[40px] p-8 shadow-sm space-y-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Users size={80} strokeWidth={1} />
                    </div>
                    
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--primary)]">Active Cluster</span>
                            <h2 className="text-2xl font-black text-[var(--text-primary)] mt-1">{household?.name || 'Private Sanctuary'}</h2>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/5 flex items-center justify-center text-[var(--primary)]">
                            <Sparkles size={18} />
                        </div>
                    </div>

                    {/* Join Code Section */}
                    <div className="p-6 rounded-[32px] bg-[var(--bg-app)] border border-[var(--border)] flex items-center justify-between shadow-inner group transition-all hover:border-[var(--primary)]/20">
                        <div>
                            <Label className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-[0.2em] opacity-40">Cluster Join Code</Label>
                            <div className="text-xl font-mono font-black text-[var(--text-primary)] tracking-[0.3em] uppercase mt-2">
                                {household?.join_code || '---'}
                            </div>
                        </div>
                        <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleCopyCode}
                            className={`h-14 w-14 rounded-2xl border flex items-center justify-center transition-all ${copied ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/20' : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-secondary)] shadow-sm'}`}
                        >
                            {copied ? <Check size={22} /> : <Copy size={22} />}
                        </motion.button>
                    </div>

                    {/* Member List */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <Label className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-[0.3em] opacity-40">Crew Manifest ({members.length})</Label>
                        </div>
                        <div className="space-y-3">
                            {members.map((m) => (
                                <motion.div 
                                    whileHover={{ x: 5 }}
                                    key={m.id} 
                                    onClick={() => router.push(`/profile/member?id=${m.id}`)}
                                    className="flex items-center justify-between p-4 rounded-3xl bg-[var(--bg-app)] border border-[var(--border)] cursor-pointer hover:border-[var(--primary)]/30 transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-2xl overflow-hidden bg-[var(--primary)]/5 border border-[var(--primary)]/10 flex items-center justify-center shadow-sm">
                                            {m.avatar_url ? (
                                                <img src={m.avatar_url} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-sm font-black text-[var(--primary)]">{m.display_name?.[0]?.toUpperCase()}</span>
                                            )}
                                        </div>
                                        <span className="text-sm font-black text-[var(--text-primary)] capitalize group-hover:text-[var(--primary)] transition-colors">{m.display_name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[var(--primary)]/5 text-[var(--primary)] border border-[var(--primary)]/10 font-black text-xs">
                                        <Flame size={14} fill="currentColor" />
                                        <span>{m.streak_count || 0}</span>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </motion.div>

                {/* Join Existing */}
                <motion.div variants={item} className="bg-[var(--bg-surface)] border border-dashed border-[var(--border)] rounded-[40px] p-8 space-y-8">
                    <div className="text-center space-y-2">
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-[var(--text-primary)]">Sync with Cluster</h3>
                        <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest opacity-40 leading-relaxed">Enter a join code to merge your metabolic data and pantry with a household.</p>
                    </div>
                    
                    <form onSubmit={handleJoinHousehold} className="flex flex-col gap-4">
                        <input 
                            placeholder="CODE" 
                            value={joinCode}
                            onChange={e => setJoinCode(e.target.value)}
                            className="w-full bg-[var(--bg-app)] border border-[var(--border)] rounded-[24px] h-16 px-6 text-center font-mono font-black text-xl tracking-[0.5em] focus:border-[var(--primary)] outline-none transition-all shadow-inner"
                        />
                        <button 
                            type="submit" 
                            disabled={isJoining || !joinCode.trim()} 
                            className="h-16 w-full bg-[var(--primary)] text-white rounded-[24px] font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-[var(--primary)]/20 active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-3"
                        >
                            {isJoining ? <Loader2 className="animate-spin" size={20} /> : <Users size={20} />}
                            {isJoining ? 'SYCHRONIZING...' : 'Initiate Merge'}
                        </button>
                    </form>
                </motion.div>

                <motion.button 
                    variants={item}
                    onClick={handleLeaveHousehold}
                    className="w-full flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-[var(--text-secondary)] opacity-40 hover:opacity-100 hover:text-[var(--error)] transition-all py-12"
                >
                    <LogOut size={14} /> Solo Protocol
                </motion.button>
            </motion.main>

            <BottomNav />
        </div>
    );
}
