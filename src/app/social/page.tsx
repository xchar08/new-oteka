'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Trophy, Flame, Users, Home, Globe, UserPlus, ChevronLeft, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/layout/BottomNav';
import { toast } from 'sonner';

type LeaderboardTab = 'global' | 'friends' | 'household';

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

export default function SocialPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('global');
  const [leaders, setLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  
  const supabase = createClient();

  // Load Data based on Active Tab
  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);
    // Fetch Pending Requests (resolve requester names via the safe public view)
    const { data: pendingRows } = await supabase
      .from('friendships')
      .select('id, user_id')
      .eq('friend_id', user.id)
      .eq('status', 'pending');

    if (pendingRows && pendingRows.length > 0) {
      const requesterIds = pendingRows.map((r) => r.user_id);
      const { data: requesters } = await supabase
        .from('public_profiles')
        .select('id, display_name, avatar_url')
        .in('id', requesterIds);
      const profileMap = Object.fromEntries((requesters || []).map((p) => [p.id, p]));
      setPendingRequests(
        pendingRows.map((r) => ({ ...r, users: profileMap[r.user_id] || null }))
      );
    } else {
      setPendingRequests([]);
    }

    let query = supabase
      .from('public_profiles')
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
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const { data } = await supabase
        .from('public_profiles')
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
        toast.error('Could not send request: ' + error.message);
    } else {
        toast.success('Friend request sent!');
        setIsInviteOpen(false);
        setSearchQuery('');
        setSearchResults([]);
    }
  }

  async function handleAccept(friendshipId: string) {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    setPendingRequests(prev => prev.filter(req => req.id !== friendshipId));
    loadData();
  }

  async function handleDecline(friendshipId: string) {
    await supabase.from('friendships').delete().eq('id', friendshipId);
    setPendingRequests(prev => prev.filter(req => req.id !== friendshipId));
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
            <button 
                onClick={() => router.back()}
                className="w-10 h-10 bg-[var(--bg-surface)] rounded-xl flex items-center justify-center shadow-sm border border-[var(--primary)]/10 text-[var(--text-secondary)]"
            >
                <ChevronLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Rankings</h1>
              <p className="text-[10px] text-[var(--primary)] font-bold uppercase tracking-widest">{activeTab} leaderboards</p>
            </div>
          </div>
          <motion.button 
              whileHover={{ scale: 1.1, backgroundColor: 'var(--primary-10)' }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsInviteOpen(true)}
              className="w-12 h-12 rounded-2xl backdrop-blur-md bg-[var(--primary)]/10 border border-[var(--primary)]/30 text-[var(--primary)] shadow-xl shadow-[var(--primary)]/10 flex items-center justify-center transition-all relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-[var(--primary)]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <UserPlus size={22} className="relative z-10 animate-pulse" />
          </motion.button>
        </div>
      </motion.header>

      <motion.main 
        variants={container}
        initial="hidden"
        animate="show"
        className="px-6 -mt-4 space-y-6"
      >
        {/* Pending Requests Inbox */}
        {pendingRequests.length > 0 && (
          <motion.div variants={item} className="space-y-3">
            <h2 className="text-[10px] text-[var(--primary)] font-bold uppercase tracking-widest px-1">Pending Requests</h2>
            {pendingRequests.map(req => (
              <div key={req.id} className="flex items-center justify-between p-4 rounded-[28px] bg-[var(--bg-surface)] border border-[var(--primary)]/30 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-[var(--primary)]" />
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center text-xs font-black text-[var(--primary)]">
                    {req.users?.display_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="text-sm font-black text-[var(--text-primary)] capitalize">{req.users?.display_name || 'Someone'}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleAccept(req.id)} className="bg-[var(--primary)] text-white h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm active:scale-95 transition-all">Accept</button>
                  <button onClick={() => handleDecline(req.id)} className="h-9 px-3 rounded-xl text-[var(--text-secondary)] text-[10px] font-black uppercase tracking-wider hover:bg-[var(--error)]/10 hover:text-[var(--error)] transition-colors">Decline</button>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Tabs */}
        <motion.div variants={item} className="flex p-1.5 bg-[var(--bg-surface)] rounded-[24px] border border-[var(--border)] shadow-sm">
          {(['global', 'friends', 'household'] as LeaderboardTab[]).map(tab => (
             <button
               key={tab}
               onClick={() => tab === 'household' ? router.push('/social/household') : setActiveTab(tab)}
               className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-[18px] transition-all flex items-center justify-center gap-2 ${
                 activeTab === tab 
                 ? 'bg-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/20' 
                 : 'text-[var(--text-secondary)] hover:bg-[var(--bg-app)]'
               }`}
             >
               {tab === 'global' && <Globe size={14} />}
               {tab === 'friends' && <Users size={14} />}
               {tab === 'household' && <Home size={14} />}
               {tab}
             </button>
          ))}
        </motion.div>

        {/* List */}
        <div className="space-y-3 pb-8">
          {loading ? (
            <div className="py-20 text-center flex flex-col items-center gap-4">
               <Loader2 className="animate-spin text-[var(--primary)] h-8 w-8" />
               <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-40">Syncing World...</span>
            </div>
          ) : leaders.length === 0 ? (
            <motion.div variants={item} className="py-20 text-center bg-[var(--bg-surface)] border border-dashed border-[var(--border)] rounded-[40px] flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-3xl bg-[var(--bg-app)] flex items-center justify-center text-[var(--text-secondary)] opacity-10">
                <Trophy size={32} />
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-40">No rankings found</p>
            </motion.div>
          ) : (
            leaders.map((u, idx) => {
              const isMe = u.id === currentUserId;
              return (
                <motion.div 
                  variants={item}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  key={u.id} 
                  onClick={() => router.push(`/profile/member?id=${u.id}`)}
                  className={`flex items-center justify-between p-4 rounded-[32px] bg-[var(--bg-surface)] border border-[var(--border)] shadow-sm cursor-pointer hover:border-[var(--primary)]/30 transition-all ${
                    isMe ? 'ring-2 ring-[var(--primary)]' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shadow-sm ${
                      idx === 0 ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-white' : 
                      idx === 1 ? 'bg-gradient-to-br from-zinc-300 to-zinc-400 text-white' : 
                      idx === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' : 
                      'bg-[var(--bg-app)] text-[var(--text-secondary)] opacity-40'
                    }`}>
                      {idx + 1}
                    </div>
                    <div>
                      <div className="text-sm font-black text-[var(--text-primary)] capitalize">{u.display_name || 'Explorer'}</div>
                      {isMe && <div className="text-[8px] font-bold text-[var(--primary)] uppercase tracking-widest">Command Center</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[var(--primary)]/5 border border-[var(--primary)]/10 text-[var(--primary)] font-black text-xs">
                     <Flame size={14} fill="currentColor" />
                     {u.streak_count || 0}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </motion.main>

      {/* Invite Modal */}
      <AnimatePresence>
        {isInviteOpen && (
           <motion.div 
             initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
             className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-6"
           >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                className="w-full max-w-sm bg-[var(--bg-app)] rounded-[40px] border border-[var(--border)] p-8 shadow-2xl space-y-8"
              >
                 <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-black tracking-tight">Find Friends</h3>
                    <button onClick={() => setIsInviteOpen(false)} className="w-10 h-10 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)]">✕</button>
                 </div>
                 <div className="relative">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-40" size={20} />
                    <input 
                      className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl h-14 pl-14 pr-6 outline-none focus:border-[var(--primary)] transition-all font-bold text-sm"
                      placeholder="Username..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                 </div>
                 <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                    {searchResults.map(u => (
                      <div key={u.id} className="flex justify-between items-center p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl group">
                        <span className="font-black text-sm capitalize">{u.display_name}</span>
                        <button 
                          onClick={() => sendFriendRequest(u.id)} 
                          className="bg-[var(--primary)] text-white h-9 px-5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[var(--primary)]/20 active:scale-95 transition-all"
                        >
                          Add
                        </button>
                      </div>
                    ))}
                    {searchResults.length === 0 && !isSearching && searchQuery && (
                       <p className="text-center text-[10px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest py-4">No explorers found</p>
                    )}
                 </div>
                 <button 
                   onClick={handleSearch} 
                   disabled={isSearching || !searchQuery} 
                   className="w-full h-14 bg-[var(--primary)] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-[var(--primary)]/20 active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-2"
                 >
                   {isSearching ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                   {isSearching ? 'Scanning...' : 'Search World'}
                 </button>
              </motion.div>
           </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
