'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MealRating } from '@/components/viz/MealRating';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function RatingPage() {
  const [rating, setRating] = useState(0);
  const [lastLogId, setLastLogId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Find the most recent un-rated log
    async function findLog() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('logs')
        .select('id, captured_at, metabolic_tags_json')
        .eq('user_id', user.id)
        .order('captured_at', { ascending: false })
        .limit(1)
        .single();
        
      if (data) {
        // Check if already rated? (Assuming we store rating in metabolic_tags_json for MVP schema simplicity)
        // Ideally schema has 'user_score' column. We will use tags for now as per schema provided.
        const tags = data.metabolic_tags_json as any;
        if (tags?.user_score) {
           // Already rated
           // setLastLogId(null); 
        } else {
           setLastLogId(data.id);
        }
      }
      setLoading(false);
    }
    findLog();
  }, []);

  const submitRating = async () => {
    if (!lastLogId || rating === 0) return;
    setSubmitting(true);

    // Update the log with the score
    // We append to the JSONB blob
    const { error } = await supabase.rpc('append_log_score', { 
        log_id: lastLogId, 
        score: rating 
    }); 
    // OR simpler client-side update if RPC not set up:
    // 1. Get current tags
    // 2. Update tags
    // 3. Write back
    
    // Simple approach for this snippet:
    const { data: current } = await supabase.from('logs').select('metabolic_tags_json').eq('id', lastLogId).single();
    const newTags = { ...(current?.metabolic_tags_json as object), user_score: rating };
    
    await supabase
      .from('logs')
      .update({ metabolic_tags_json: newTags })
      .eq('id', lastLogId);

    setSubmitting(false);
    router.push('/dashboard'); // Return home
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  if (!lastLogId) {
    return (
      <div className="p-6 text-center space-y-4 pt-20">
        <h1 className="text-xl font-bold text-gray-800">All Caught Up!</h1>
        <p className="text-gray-500">You have no recent meals to rate.</p>
        <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-md mx-auto min-h-screen flex flex-col justify-center space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">How did you feel?</h1>
        <p className="text-gray-500">Rate your energy levels 2 hours post-meal.</p>
      </div>
      
      <Card className="p-8 flex justify-center items-center shadow-md">
        <MealRating score={rating} onRate={setRating} size={40} />
      </Card>

      <div className="space-y-4">
        <div className="text-center h-6 text-sm font-medium text-blue-600 transition-opacity duration-300">
           {rating === 1 && "Low Energy / Bloated"}
           {rating === 2 && "Slightly Sluggish"}
           {rating === 3 && "Neutral / Okay"}
           {rating === 4 && "Good Energy"}
           {rating === 5 && "High Performance / Focused"}
        </div>

        <Button 
          className="w-full h-12 text-lg" 
          disabled={rating === 0 || submitting}
          onClick={submitRating}
        >
          {submitting ? 'Saving...' : 'Submit Feedback'}
        </Button>
      </div>
    </div>
  );
}
