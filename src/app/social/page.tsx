'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Trophy, Flame, Users, Home, Globe, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

type LeaderboardTab = 'global' | 'friends' | 'household';

export default function SocialPage() {
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
        // Top 50 Global
        query = query.order('streak_count', { ascending: false }).limit(50);
      } 
      else if (activeTab === 'friends') {
        // Fetch IDs of accepted friends
        const { data: friendships } = await supabase
          .from('friendships')
          .select('user_id, friend_id')
          .eq('status', 'accepted')
          .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

        const friendIds = friendships?.map(f => 
          f.user_id === user.id ? f.friend_id : f.user_id
        ) || [];
        
        // Include self
        friendIds.push(user.id);

        query = query.in('id', friendIds).order('streak_count', { ascending: false });
      } 
      else if (activeTab === 'household') {
        // Get user's household ID first
        const { data: me } = await supabase
          .from('users')
          .select('household_id')
          .eq('id', user.id)
          .single();

        if (me?.household_id) {
          query = query.eq('household_id', me.household_id).order('streak_count', { ascending: false });
        } else {
          // User has no household
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

  // ... inside SocialPage ...
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    
    // Simple search by display_name
    const { data } = await supabase
        .from('users')
        .select('id, display_name, streak_count')
        .ilike('display_name', `%${searchQuery}%`)
        .limit(5);

    // Filter out self and existing friends (basic client-side filter for now)
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
        }); // Check RLS: user_id must be auth.uid(), which it is.

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
    <div className="min-h-screen bg-[var(--palenight-bg)] p-6 pb-24 space-y-6 text-zinc-100 relative">
      <div className="fixed top-0 left-0 w-full h-[50vh] bg-blue-900/10 blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6 relative z-10 pt-safe">
        <div className="flex items-center gap-3">
          <Trophy className="text-yellow-500" size={32} />
          <div>
            <h1 className="text-3xl font-light tracking-tight text-white">Rankings</h1>
            <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">
              {activeTab === 'global' ? 'World Top 50' : activeTab === 'friends' ? 'Your Circle' : 'Household Stats'}
            </p>
          </div>
        </div>
        <Button 
            className="h-10 w-10 p-0 rounded-full bg-blue-600 hover:bg-blue-500 shadow-lg text-white"
            onClick={() => setIsInviteOpen(true)}
        >
          <UserPlus size={18} />
        </Button>
      </div>

      {/* ADD FRIEND MODAL */}
      {isInviteOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 animate-in fade-in">
            <div className="w-full max-w-md bg-[var(--palenight-surface)] border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white">Add Friend</h3>
                    <button onClick={() => setIsInviteOpen(false)} className="text-zinc-400 hover:text-white">✕</button>
                </div>
                
                <div className="flex gap-2">
                    <input 
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                        placeholder="Search by username..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button onClick={handleSearch} disabled={isSearching} className="bg-blue-600">
                        {isSearching ? '...' : 'Search'}
                    </Button>
                </div>

                <div className="space-y-2 mt-2 max-h-60 overflow-y-auto">
                    {searchResults.map(user => (
                        <div key={user.id} className="flex justify-between items-center bg-white/5 p-3 rounded-lg hover:bg-white/10 transition">
                            <div>
                                <div className="font-medium text-white">{user.display_name}</div>
                                <div className="text-xs text-zinc-400 flex items-center gap-1">
                                    <Flame size={10} className="text-orange-500"/> {user.streak_count} Streak
                                </div>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => sendFriendRequest(user.id)} className="h-8 border-blue-500/30 text-blue-400 hover:bg-blue-500/20">
                                Add
                            </Button>
                        </div>
                    ))}
                    {searchResults.length === 0 && searchQuery && !isSearching && (
                        <p className="text-center text-zinc-500 text-sm py-4">No users found.</p>
                    )}
                </div>
            </div>
         </div>
      )}

      {/* Tabs */}
      <div className="flex p-1 bg-[var(--palenight-surface)] rounded-lg border border-white/5 relative z-10">
        <button
          onClick={() => setActiveTab('global')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${
            activeTab === 'global' ? 'bg-[var(--palenight-bg)] shadow text-white' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Globe size={14} /> Global
        </button>
        <button
          onClick={() => setActiveTab('friends')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${
            activeTab === 'friends' ? 'bg-[var(--palenight-bg)] shadow text-white' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Users size={14} /> Friends
        </button>
        <button
          onClick={() => setActiveTab('household')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${
            activeTab === 'household' ? 'bg-[var(--palenight-bg)] shadow text-white' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Home size={14} /> Home
        </button>
      </div>

      {/* Content */}
      <div className="bg-[var(--palenight-surface)] rounded-xl shadow-lg border border-white/5 overflow-hidden min-h-[300px] relative z-10">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Updating ranks...</div>
        ) : leaders.length === 0 ? (
          <div className="p-10 text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 bg-palenight-bg rounded-full flex items-center justify-center text-zinc-500">
              {activeTab === 'household' ? <Home size={24}/> : <Users size={24}/>}
            </div>
            <p className="text-zinc-400 font-medium">No one here yet.</p>
            {activeTab === 'household' && (
              <p className="text-sm text-gray-400">Join a household to share pantry stats.</p>
            )}
            {activeTab === 'friends' && (
              <Button onClick={() => setIsInviteOpen(true)} className="text-blue-400 hover:text-white" variant="ghost">Invite Friends</Button>
            )}
          </div>
        ) : (
          leaders.map((user, idx) => {
            const isMe = user.id === currentUserId;
            const name = user.display_name || `User ${user.id.slice(0, 4)}`;

            return (
              <div 
                key={user.id} 
                className={`flex items-center justify-between p-4 border-b border-white/5 last:border-0 transition-colors ${
                  isMe ? 'bg-blue-500/10 border-l-4 border-l-blue-500' : 
                  (idx < 3 && activeTab === 'global') ? 'bg-yellow-500/5' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className={`
                    w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm shadow-sm
                    ${idx === 0 ? 'bg-yellow-500/20 text-yellow-500 ring-1 ring-yellow-500/50' : 
                      idx === 1 ? 'bg-zinc-700 text-zinc-300' : 
                      idx === 2 ? 'bg-orange-900/40 text-orange-400 border border-orange-700/50' : 'text-zinc-500 bg-palenight-bg border border-white/5'}
                  `}>
                    {idx + 1}
                  </span>
                  <div className="flex flex-col">
                    <span className={`text-sm font-medium ${isMe ? 'text-blue-400' : 'text-zinc-200'}`}>
                      {name} {isMe && '(You)'}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 text-orange-500 font-bold bg-orange-500/10 px-2 py-1 rounded-md border border-orange-500/20">
                  <Flame size={16} fill="currentColor" />
                  {user.streak_count}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
