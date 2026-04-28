'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Trophy, Flame, Users, Home, Globe, UserPlus, ChevronLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/layout/BottomNav';

type LeaderboardTab = 'global' | 'friends' | 'household';

export default function SocialPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('global');
  const [leaders, setLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const supabase = createClient();

  // Load Data based on Active Tab
  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      let query = supabase
        .from('users')
        .select('id, streak_count, display_name, household_id');

      if (activeTab === 'global') {
        query = query.order('streak_count', { ascending: false }).limit(50);
      } 
      else if (activeTab === 'friends') {
        const { data: friendships } = await supabase
          .from('friendships')
          .select('user_id, friend_id')
          .eq('status', 'accepted')
          .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

        const friendIds = friendships?.map(f => 
          f.user_id === user.id ? f.friend_id : f.user_id
        ) || [];
        
        friendIds.push(user.id);
        query = query.in('id', friendIds).order('streak_count', { ascending: false });
      } 
      else if (activeTab === 'household') {
        const { data: me } = await supabase
          .from('users')
          .select('household_id')
          .eq('id', user.id)
          .single();

        if (me?.household_id) {
          query = query.eq('household_id', me.household_id).order('streak_count', { ascending: false });
        } else {
          setLeaders([]);
          setLoading(false);
          return;
        }
      }

      const { data } = await query;
      setLeaders(data || []);
      setLoading(false);
    }

    load();
  }, [activeTab]);

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const { data } = await supabase
        .from('users')
        .select('id, display_name, streak_count')
        .ilike('display_name', `%${searchQuery}%`)
        .limit(5);
    setSearchResults(data?.filter(u => u.id !== currentUserId) || []);
    setIsSearching(false);
  }

  async function sendFriendRequest(friendId: string) {
    const { error } = await supabase
        .from('friendships')
        .insert({
            user_id: currentUserId,
            friend_id: friendId,
            status: 'pending' 
        });

    if (error) {
        alert('Could not send request: ' + error.message);
    } else {
        alert('Friend request sent!');
        setIsInviteOpen(false);
        setSearchQuery('');
        setSearchResults([]);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] p-6 pb-32 space-y-8 text-[var(--text-primary)] transition-colors duration-500">
      
      {/* Header */}
      <header className="flex items-center justify-between pt-safe">
        <div className="flex items-center gap-4">
          <button 
              onClick={() => router.back()}
              className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
          >
              <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Rankings</h1>
            <p className="text-[10px] text-[var(--primary)] font-bold uppercase tracking-widest">{activeTab} leaderboards</p>
          </div>
        </div>
        <button 
            onClick={() => setIsInviteOpen(true)}
            className="w-12 h-12 rounded-2xl bg-[var(--primary)] text-white shadow-lg flex items-center justify-center active:scale-90 transition-all"
        >
          <UserPlus size={22} />
        </button>
      </header>

      {/* Tabs */}
      <div className="flex p-1.5 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-sm">
        {(['global', 'friends', 'household'] as LeaderboardTab[]).map(tab => (
           <button
             key={tab}
             onClick={() => tab === 'household' ? router.push('/social/household') : setActiveTab(tab)}
             className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${
               activeTab === tab 
               ? 'bg-[var(--primary)] text-white shadow-md' 
               : 'text-[var(--text-secondary)] hover:bg-[var(--bg-app)]'
             }`}
           >
             {tab === 'global' && <Globe size={14} />}
             {tab === 'friends' && <Users size={14} />}
             {tab === 'household' && <Home size={14} />}
             {tab}
           </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center gap-4">
             <Loader2 className="animate-spin text-[var(--primary)] h-8 w-8" />
             <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Syncing World...</span>
          </div>
        ) : leaders.length === 0 ? (
          <div className="py-20 text-center bg-[var(--bg-surface)] border border-dashed border-[var(--border)] rounded-[32px] flex flex-col items-center gap-4">
            <Trophy className="text-[var(--text-secondary)] opacity-10 h-12 w-12" />
            <p className="text-sm font-bold text-[var(--text-secondary)]">No rankings available yet.</p>
          </div>
        ) : (
          leaders.map((u, idx) => {
            const isMe = u.id === currentUserId;
            return (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={u.id} 
                className={`flex items-center justify-between p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-sm ${
                  isMe ? 'ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--bg-app)]' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${
                    idx === 0 ? 'bg-yellow-400 text-white shadow-lg' : 
                    idx === 1 ? 'bg-zinc-300 text-white shadow-md' : 
                    idx === 2 ? 'bg-orange-400 text-white shadow-sm' : 
                    'bg-[var(--bg-app)] text-[var(--text-secondary)]'
                  }`}>
                    {idx + 1}
                  </div>
                  <div>
                    <div className="text-sm font-black text-[var(--text-primary)] capitalize">{u.display_name || 'Explorer'}</div>
                    {isMe && <div className="text-[8px] font-bold text-[var(--primary)] uppercase tracking-widest">You</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--primary)]/5 border border-[var(--primary)]/10 text-[var(--primary)] font-black text-xs">
                   <Flame size={14} fill="currentColor" />
                   {u.streak_count || 0}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Invite Modal */}
      <AnimatePresence>
        {isInviteOpen && (
           <motion.div 
             initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
             className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-6"
           >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                className="w-full max-w-sm bg-[var(--bg-app)] rounded-[32px] border border-[var(--border)] p-6 shadow-2xl space-y-6"
              >
                 <div className="flex justify-between items-center">
                    <h3 className="text-xl font-black">Find Friends</h3>
                    <button onClick={() => setIsInviteOpen(false)} className="w-10 h-10 rounded-full bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center">✕</button>
                 </div>
                 <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-40" size={18} />
                    <input 
                      className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl h-14 pl-12 pr-6 outline-none focus:border-[var(--primary)] transition-all font-medium"
                      placeholder="Username..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                 </div>
                 <div className="space-y-2 max-h-48 overflow-y-auto">
                    {searchResults.map(u => (
                      <div key={u.id} className="flex justify-between items-center p-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl">
                        <span className="font-bold text-sm capitalize">{u.display_name}</span>
                        <Button onClick={() => sendFriendRequest(u.id)} size="sm" className="bg-[var(--primary)] h-8 rounded-xl px-4">Add</Button>
                      </div>
                    ))}
                 </div>
                 <Button onClick={handleSearch} disabled={isSearching || !searchQuery} className="w-full h-14 bg-[var(--primary)] rounded-2xl font-black uppercase tracking-widest">
                   {isSearching ? 'Scanning...' : 'Search World'}
                 </Button>
              </motion.div>
           </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
