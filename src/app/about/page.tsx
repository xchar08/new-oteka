'use client';

import { motion } from 'framer-motion';
import { ChevronLeft, Info, Cpu, Globe, Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/layout/BottomNav';

export default function AboutPage() {
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
           <h1 className="text-3xl font-black tracking-tight mb-1">About</h1>
           <p className="text-[var(--text-secondary)] text-sm font-bold uppercase tracking-widest">Oteka Neural Engine</p>
        </div>
      </header>

      <div className="space-y-6 max-w-2xl mx-auto">
        
        {/* Intro */}
        <section className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[32px] p-8 shadow-sm">
            <div className="w-14 h-14 bg-[var(--primary)]/10 rounded-2xl flex items-center justify-center text-[var(--primary)] mb-6">
                <Info size={30} />
            </div>
            <h2 className="text-2xl font-black mb-4">Metabolic Intelligence</h2>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed font-medium">
                Oteka is designed to remove the biological friction from human performance. By combining volumetric computer vision with real-time metabolic planning, we provide a unified stack for your health.
            </p>
        </section>

        {/* Tech Stack */}
        <div className="grid grid-cols-1 gap-4">
            {[
                { 
                    icon: Cpu, 
                    title: "Volumetric Vision", 
                    desc: "State-of-the-art neural networks (Gemini 3.1 + DeepSeek) to calculate precise caloric density from a single image."
                },
                { 
                    icon: Globe, 
                    title: "Entropy Logistics", 
                    desc: "Intelligent pantry tracking that uses daily probability decay to manage your household supply automatically."
                },
                { 
                    icon: Heart, 
                    title: "Biological Guardrails", 
                    desc: "Personalized constraints based on your medical history, ensuring every AI recommendation is safe and aligned."
                }
            ].map((item, idx) => (
                <motion.div 
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex gap-5 p-6 bg-[var(--bg-surface)] border border-[var(--border)] rounded-[28px] shadow-sm"
                >
                    <div className="shrink-0">
                        <item.icon size={22} className="text-[var(--primary)]" />
                    </div>
                    <div>
                        <h3 className="font-black text-sm uppercase tracking-tight mb-1">{item.title}</h3>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-medium">{item.desc}</p>
                    </div>
                </motion.div>
            ))}
        </div>

        {/* Version */}
        <div className="pt-8 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--text-secondary)] opacity-30">Solar Core v3.1.0-Release</p>
        </div>

      </div>

      <BottomNav />
    </div>
  );
}
