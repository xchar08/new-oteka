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

  return (
    <div className="min-h-screen bg-[var(--palenight-bg)] p-6 pb-24 space-y-6 text-zinc-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Trophy className="text-yellow-500" size={32} />
          <div>
            <h1 className="text-2xl font-bold">Rankings</h1>
            <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">
              {activeTab === 'global' ? 'World Top 50' : activeTab === 'friends' ? 'Your Circle' : 'Household Stats'}
            </p>
          </div>
        </div>
        <Button className="h-8 w-8 p-0 rounded-full">
          <UserPlus size={16} />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-[var(--palenight-surface)] rounded-lg border border-white/5">
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
      <div className="bg-[var(--palenight-surface)] rounded-xl shadow-lg border border-white/5 overflow-hidden min-h-[300px]">
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
              <Button className="text-blue-600">Invite Friends</Button>
            )}
          </div>
        ) : (
          leaders.map((user, idx) => {
            const isMe = user.id === currentUserId;
            const name = user.display_name || `User ${user.id.slice(0, 4)}`;

            return (
              <div 
                key={user.id} 
                className={`flex items-center justify-between p-4 border-b last:border-0 transition-colors ${
                  isMe ? 'bg-blue-50 border-l-4 border-l-blue-500' : 
                  (idx < 3 && activeTab === 'global') ? 'bg-yellow-50/30' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className={`
                    w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm shadow-sm
                    ${idx === 0 ? 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-200' : 
                      idx === 1 ? 'bg-gray-100 text-gray-700' : 
                      idx === 2 ? 'bg-orange-900/40 text-orange-400 border border-orange-700/50' : 'text-zinc-500 bg-palenight-bg border border-white/5'}
                  `}>
                    {idx + 1}
                  </span>
                  <div className="flex flex-col">
                    <span className={`text-sm font-medium ${isMe ? 'text-blue-700' : 'text-gray-900'}`}>
                      {name} {isMe && '(You)'}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 text-orange-500 font-bold bg-orange-50 px-2 py-1 rounded-md">
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
