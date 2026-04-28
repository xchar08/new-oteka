'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Users, UserPlus, Copy, Check, LogOut, ChevronLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { BottomNav } from '@/components/layout/BottomNav';

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
        <div className="min-h-screen bg-[var(--bg-app)] p-6 pb-32 space-y-8 animate-in fade-in duration-500 overflow-x-hidden transition-colors">
            {/* Header */}
            <header className="flex items-center justify-between pt-safe relative z-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] shadow-sm">
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">Household</h1>
                        <p className="text-[var(--text-secondary)] text-xs font-bold uppercase tracking-widest">Shared Vitality</p>
                    </div>
                </div>
                <div className="w-12 h-12 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl flex items-center justify-center text-[var(--primary)] shadow-sm">
                    <Home size={24} />
                </div>
            </header>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6 relative z-10"
            >
                {/* Current Household Status */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[32px] p-6 shadow-sm space-y-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-xl font-black text-[var(--text-primary)]">{household?.name || 'Private Sanctuary'}</h2>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--primary)] mt-1">Active Cluster</p>
                        </div>
                        <Users className="text-[var(--text-secondary)] opacity-20" size={32} />
                    </div>

                    {/* Join Code Section */}
                    <div className="p-4 rounded-2xl bg-[var(--bg-app)] border border-[var(--border)] flex items-center justify-between shadow-inner">
                        <div>
                            <Label className="text-[9px] text-[var(--text-secondary)] font-black uppercase tracking-widest">Household Join Code</Label>
                            <div className="text-lg font-mono font-black text-[var(--text-primary)] tracking-widest uppercase mt-1">
                                {household?.join_code || '---'}
                            </div>
                        </div>
                        <button 
                            onClick={handleCopyCode}
                            className={`h-12 w-12 rounded-xl border flex items-center justify-center transition-all active:scale-90 ${copied ? 'bg-[var(--primary)] border-[var(--primary)] text-white' : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-secondary)] shadow-sm'}`}
                        >
                            {copied ? <Check size={20} /> : <Copy size={20} />}
                        </button>
                    </div>

                    {/* Member List */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <Label className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-[0.2em]">Members ({members.length})</Label>
                            <UserPlus size={14} className="text-[var(--primary)]" />
                        </div>
                        <div className="space-y-2">
                            {members.map((m) => (
                                <div key={m.id} className="flex items-center justify-between p-3 rounded-2xl bg-[var(--bg-app)] border border-[var(--border)]">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl overflow-hidden bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex items-center justify-center">
                                            {m.avatar_url ? (
                                                <img src={m.avatar_url} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-xs font-black text-[var(--primary)]">{m.display_name?.[0]?.toUpperCase()}</span>
                                            )}
                                        </div>
                                        <span className="text-sm font-black text-[var(--text-primary)] capitalize">{m.display_name}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--primary)]/5 text-[var(--primary)] border border-[var(--primary)]/10">
                                        <Flame size={12} fill="currentColor" />
                                        <span className="text-[10px] font-black">{m.streak_count || 0}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Join Existing */}
                <div className="bg-[var(--bg-surface)] border border-dashed border-[var(--border)] rounded-[32px] p-8 space-y-6">
                    <div className="text-center space-y-2">
                        <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-primary)]">Sync with another Cluster</h3>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">Enter a join code to merge your metabolic data and pantry with a household.</p>
                    </div>
                    
                    <form onSubmit={handleJoinHousehold} className="flex gap-3">
                        <input 
                            placeholder="CODE" 
                            value={joinCode}
                            onChange={e => setJoinCode(e.target.value)}
                            className="flex-1 bg-[var(--bg-app)] border border-[var(--border)] rounded-2xl h-14 px-6 text-center font-mono font-black text-lg focus:border-[var(--primary)] outline-none transition-all shadow-inner"
                        />
                        <button 
                            type="submit" 
                            disabled={isJoining || !joinCode.trim()} 
                            className="h-14 px-8 bg-[var(--primary)] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg active:scale-95 disabled:opacity-30 transition-all"
                        >
                            {isJoining ? '...' : 'Merge'}
                        </button>
                    </form>
                </div>

                <button 
                    onClick={handleLeaveHousehold}
                    className="w-full flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-secondary)] hover:text-[var(--error)] transition-colors py-8"
                >
                    <LogOut size={14} /> Solo Protocol
                </button>
            </motion.div>

            <BottomNav />
        </div>
    );
}
