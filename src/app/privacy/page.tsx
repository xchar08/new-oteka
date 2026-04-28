'use client';

import { motion } from 'framer-motion';
import { ChevronLeft, Shield, Lock, Eye, Database, Share2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/layout/BottomNav';

export default function PrivacyPolicyPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] p-6 pb-32 transition-colors duration-500 font-sans">
      
      {/* Header */}
      <header className="flex items-center gap-4 pt-safe mb-8">
        <button 
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
        >
            <ChevronLeft size={24} />
        </button>
        <div>
           <h1 className="text-3xl font-black tracking-tight mb-1">Privacy</h1>
           <p className="text-[var(--text-secondary)] text-sm font-bold uppercase tracking-widest">Protocol & Security</p>
        </div>
      </header>

      <div className="space-y-8 max-w-2xl mx-auto">
        
        {/* Intro Card */}
        <section className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[32px] p-6 shadow-sm">
            <div className="w-12 h-12 bg-[var(--primary)]/10 rounded-2xl flex items-center justify-center text-[var(--primary)] mb-4">
                <Shield size={24} />
            </div>
            <h2 className="text-xl font-black mb-2">Our Commitment</h2>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed font-medium">
                Oteka AI is built on the principle of biological sovereignty. Your metabolic data belongs to you. We never sell your personal information or nutritional patterns to third parties.
            </p>
        </section>

        {/* Detailed Sections */}
        <div className="space-y-6 px-2">
            {[
                { 
                    icon: Lock, 
                    title: "Data Encryption", 
                    content: "All biological and biometric data is encrypted at rest and in transit using industry-standard protocols. Your camera feed is processed in real-time and raw images are not stored unless you explicitly opt-in for neural training."
                },
                { 
                    icon: Database, 
                    title: "Health Metrics", 
                    content: "We collect Age, Weight, Height, and medical conditions (like Diabetes or IBS) solely to calibrate the metabolic engine's safety constraints and provide accurate baseline recommendations."
                },
                { 
                    icon: Eye, 
                    title: "AI Analysis", 
                    content: "The AI analysis of your meals is stored to build your personal history and improve the accuracy of future caloric estimations. This data is linked only to your secure account profile."
                },
                { 
                    icon: Share2, 
                    title: "Household Sync", 
                    content: "If you choose to join a household, only your pantry inventory and streak count are visible to other members. Individual nutritional logs remain private unless explicitly shared."
                }
            ].map((section, idx) => (
                <motion.div 
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex gap-4"
                >
                    <div className="mt-1">
                        <section.icon size={18} className="text-[var(--primary)]" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm uppercase tracking-widest text-[var(--text-primary)] mb-2">{section.title}</h3>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-medium">{section.content}</p>
                    </div>
                </motion.div>
            ))}
        </div>

        {/* Compliance */}
        <section className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[32px] p-8 text-center space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest">Right to Deletion</h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-medium italic">
                You may request a full export or permanent deletion of your metabolic history at any time through the Account Settings.
            </p>
            <div className="pt-4">
                <button 
                    onClick={() => router.back()}
                    className="px-8 py-3 bg-[var(--primary)] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all"
                >
                    Acknowledge
                </button>
            </div>
        </section>

      </div>

      <BottomNav />
    </div>
  );
}
