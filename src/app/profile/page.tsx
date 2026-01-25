'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return router.push('/login');

      const { data } = await supabase.from('users').select('*').eq('id', authUser.id).single();
      setUser(data);
    }
    load();
  }, [router, supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (!user) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>
      
      <div className="bg-white p-4 rounded-lg border shadow-sm space-y-2">
        <div className="text-sm text-gray-500">User ID</div>
        <div className="font-mono text-xs break-all">{user.id}</div>
      </div>

      <div className="bg-white p-4 rounded-lg border shadow-sm space-y-4">
        <h2 className="font-semibold">Physics Calibration</h2>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Hand Width</span>
          <span className="font-bold">{user.hand_width_mm || '--'} mm</span>
        </div>
        <Link href="/onboarding/calibration" className="block">
          <Button className="w-full bg-gray-900">Recalibrate</Button>
        </Link>
      </div>

      <div className="bg-white p-4 rounded-lg border shadow-sm space-y-4">
        <h2 className="font-semibold">Metabolic Settings</h2>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Goal</span>
          <span className="capitalize font-medium">{user.metabolic_state_json?.current_goal || 'Maintenance'}</span>
        </div>
      </div>

      <Button className="w-full text-red-600 border-red-200" onClick={handleSignOut}>
        Sign Out
      </Button>
    </div>
  );
}
