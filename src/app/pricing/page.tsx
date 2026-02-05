'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
// import { createCheckoutSession } from '@/app/actions/stripe';

export default function PricingPage() {
  const handleSubscribe = async () => {
    // Hardcoded Price ID for "Pro" tier - In production, use env or DB
    const PRICE_ID = 'price_1Qj...'; // Placeholder, user needs to set this
    try {
        // await createCheckoutSession(PRICE_ID);
        alert("This feature requires a backend. (Static Build Demo)");
    } catch (err) {
        alert('Failed to start checkout. Check console.');
        console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--palenight-bg)] text-white flex flex-col items-center py-20 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Upgrade to Oteka+</h1>
        <p className="text-zinc-400 max-w-lg mx-auto">
          Unlock the full power of the internal Volumetric Vision Engine and Genetic Planner.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl w-full">
        {/* FREE */}
        <div className="bg-[var(--palenight-surface)] border border-white/5 rounded-2xl p-8 flex flex-col shadow-lg">
          <div className="mb-4">
             <h3 className="text-xl font-semibold">Free</h3>
             <div className="text-3xl font-bold mt-2">$0<span className="text-base font-normal text-zinc-500">/mo</span></div>
          </div>
          <ul className="space-y-3 mb-8 flex-1">
            <li className="flex items-center text-zinc-300"><Check className="mr-2 h-4 w-4 text-zinc-500" /> Basic logging</li>
            <li className="flex items-center text-zinc-300"><Check className="mr-2 h-4 w-4 text-zinc-500" /> Manual pantry</li>
            <li className="flex items-center text-zinc-300"><Check className="mr-2 h-4 w-4 text-zinc-500" /> 1 Meal Plan / Day</li>
          </ul>
          <Button variant="outline" className="w-full border-zinc-700 hover:bg-zinc-800 text-zinc-300">
            Current Plan
          </Button>
        </div>

        {/* PRO */}
        <div className="bg-gradient-to-b from-blue-900/20 to-[var(--palenight-surface)] border border-blue-500/30 rounded-2xl p-8 flex flex-col relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 bg-blue-600 text-xs font-bold px-3 py-1 rounded-bl-lg">POPULAR</div>
          <div className="mb-4">
             <h3 className="text-xl font-semibold text-blue-400">Oteka+</h3>
             <div className="text-3xl font-bold mt-2">$9.99<span className="text-base font-normal text-zinc-500">/mo</span></div>
          </div>
          <ul className="space-y-3 mb-8 flex-1">
            <li className="flex items-center text-zinc-100"><Check className="mr-2 h-4 w-4 text-blue-500" /> <strong>Unlimited</strong> Vision Logs</li>
            <li className="flex items-center text-zinc-100"><Check className="mr-2 h-4 w-4 text-blue-500" /> <strong>Genetic AI</strong> Optimization</li>
            <li className="flex items-center text-zinc-100"><Check className="mr-2 h-4 w-4 text-blue-500" /> Metabolic Advisor (DeepSeek)</li>
            <li className="flex items-center text-zinc-100"><Check className="mr-2 h-4 w-4 text-blue-500" /> Offline Sync Queue</li>
          </ul>
          <form action={async () => {
             // In a real app we pass the ID. Since we are in client component, we call server action wrapper
             await handleSubscribe();
          }}>
             <Button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold">
                Upgrade Now
             </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
