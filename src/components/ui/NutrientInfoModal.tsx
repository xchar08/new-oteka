'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Target, Lightbulb, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface NutrientInfo {
  name: string;
  bioOptimizer: string;
  benefits: string[];
  sources: string[];
  category: 'macro' | 'vitamin' | 'mineral' | 'other';
}

export const NUTRIENT_DATABASE: Record<string, NutrientInfo> = {
  // Macros
  'Protein': {
    name: 'Protein',
    bioOptimizer: 'The fundamental building block for structural integrity and metabolic signaling.',
    benefits: ['Muscle Tissue Synthesis', 'Enzyme & Hormone Production', 'Immune Function Support'],
    sources: ['Chicken Breast', 'Eggs', 'Greek Yogurt', 'Lentils'],
    category: 'macro'
  },
  'Carbs': {
    name: 'Carbohydrates',
    bioOptimizer: 'The primary plasma fuel for high-intensity cognitive and physical performance.',
    benefits: ['Glycogen Replenishment', 'Rapid ATP Generation', 'Thyroid Function Support'],
    sources: ['Sweet Potato', 'Oats', 'Blueberries', 'Quinoa'],
    category: 'macro'
  },
  'Fats': {
    name: 'Fats',
    bioOptimizer: 'Crucial for cellular membrane stability and steroid hormone synthesis.',
    benefits: ['Brain Health & Myelin Support', 'Vitamin Absorption (A,D,E,K)', 'Long-term Energy Density'],
    sources: ['Avocado', 'Extra Virgin Olive Oil', 'Walnuts', 'Wild Salmon'],
    category: 'macro'
  },
  'Fiber': {
    name: 'Fiber',
    bioOptimizer: 'Regulates glucose kinetic stability and optimizes the gut microbiome.',
    benefits: ['Microbiome Diversity', 'Blood Sugar Blunting', 'Digestive Transit Efficiency'],
    sources: ['Chia Seeds', 'Broccoli', 'Raspberries', 'Avocado'],
    category: 'macro'
  },
  // Minerals
  'Magnesium': {
    name: 'Magnesium',
    bioOptimizer: 'Crucial for 300+ enzymatic reactions and cellular ATP production.',
    benefits: ['Enhanced Sleep Quality', 'ATP Energy Synthesis', 'Muscle Relaxation'],
    sources: ['Spinach', 'Pumpkin Seeds', 'Dark Chocolate', 'Almonds'],
    category: 'mineral'
  },
  'Iron': {
    name: 'Iron',
    bioOptimizer: 'Essential for systemic oxygen transport and cellular mitochondrial function.',
    benefits: ['Hemoglobin Synthesis', 'Energy Levels', 'Cognitive Focus'],
    sources: ['Red Meat', 'Spinach', 'Lentils', 'Pumpkin Seeds'],
    category: 'mineral'
  },
  'Zinc': {
    name: 'Zinc',
    bioOptimizer: 'The primary catalyst for DNA synthesis and immune cell signaling.',
    benefits: ['T-Cell Production', 'Testosterone Optimization', 'Skin Integrity'],
    sources: ['Oysters', 'Pumpkin Seeds', 'Beef', 'Chickpeas'],
    category: 'mineral'
  },
  'Potassium': {
    name: 'Potassium',
    bioOptimizer: 'The master electrolyte for intracellular fluid balance and cardiac rhythm.',
    benefits: ['Blood Pressure Regulation', 'Nerve Transmission', 'Muscle Cramp Prevention'],
    sources: ['Banana', 'Coconut Water', 'Potatoes', 'Spinach'],
    category: 'mineral'
  },
  // Vitamins
  'Vitamin C': {
    name: 'Vitamin C',
    bioOptimizer: 'The primary antioxidant for collagen synthesis and oxidative stress mitigation.',
    benefits: ['Collagen Integrity', 'Immune Resilience', 'Cortisol Regulation'],
    sources: ['Bell Peppers', 'Oranges', 'Strawberries', 'Kiwi'],
    category: 'vitamin'
  },
  'Vitamin D': {
    name: 'Vitamin D',
    bioOptimizer: 'The "Hormone-Vitamin" that regulates 1,000+ genes and bone density.',
    benefits: ['Calcium Absorption', 'Mood Regulation', 'Immune Surveillance'],
    sources: ['Sunlight', 'Fatty Fish', 'Egg Yolks', 'Mushrooms'],
    category: 'vitamin'
  },
  'Vitamin B12': {
    name: 'Vitamin B12',
    bioOptimizer: 'Critical for nerve sheath maintenance and red blood cell maturation.',
    benefits: ['Myelin Support', 'Energy Metabolism', 'DNA Methylation'],
    sources: ['Beef', 'Eggs', 'Clams', 'Nutritional Yeast'],
    category: 'vitamin'
  }
};

interface NutrientInfoModalProps {
  nutrientName: string;
  isOpen: boolean;
  onClose: () => void;
  currentDv?: number;
}

export function NutrientInfoModal({ nutrientName, isOpen, onClose, currentDv }: NutrientInfoModalProps) {
  // Try to find exact match, or case-insensitive match
  const info = NUTRIENT_DATABASE[nutrientName] || 
               Object.values(NUTRIENT_DATABASE).find(v => v.name.toLowerCase() === nutrientName.toLowerCase());

  if (!info) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-x-6 top-[15%] bottom-[15%] max-w-lg mx-auto bg-[#1a1206] border border-[var(--primary)]/30 rounded-[40px] z-[101] shadow-[0_0_50px_rgba(255,140,0,0.15)] overflow-hidden flex flex-col font-sans"
          >
            {/* Glass Highlight */}
            <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-[var(--primary)]/5 to-transparent pointer-events-none" />
            
            {/* Header */}
            <div className="p-8 pb-4 flex justify-between items-start relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center border border-[var(--primary)]/20 shadow-inner">
                  <Zap className="text-[var(--primary)] w-7 h-7" />
                </div>
                <div>
                   <h2 className="text-3xl font-black tracking-tight text-[var(--text-primary)]">{info.name}</h2>
                   <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--primary)] opacity-70">
                     {info.category} Optimization
                   </span>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
                <X size={20} className="text-[var(--text-secondary)]" />
              </button>
            </div>

            {/* Content */}
            <div className="p-8 pt-0 flex-1 overflow-y-auto space-y-8 relative z-10 scrollbar-hide">
              {/* Summary */}
              <div className="p-5 rounded-3xl bg-white/5 border border-white/10 shadow-sm">
                <p className="text-sm font-medium leading-relaxed text-[var(--text-secondary)] italic">
                  "{info.bioOptimizer}"
                </p>
              </div>

              {/* Benefits */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--primary)] flex items-center gap-2">
                  <Target size={14} /> Metabolic Wins
                </h3>
                <div className="space-y-3">
                  {info.benefits.map((benefit, i) => (
                    <div key={i} className="flex items-center gap-3 group">
                       <div className="w-2 h-2 rounded-full bg-[var(--primary)] shadow-[0_0_8px_rgba(255,140,0,0.5)]" />
                       <span className="text-sm font-bold text-[var(--text-primary)] opacity-90">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sources */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--primary)] flex items-center gap-2">
                  <Lightbulb size={14} /> Biological Prime Sources
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {info.sources.map((source, i) => (
                    <div key={i} className="px-4 py-3 rounded-2xl bg-white/5 border border-white/5 text-xs font-bold text-[var(--text-secondary)] flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]/30" />
                      {source}
                    </div>
                  ))}
                </div>
              </div>

              {/* Progress */}
              {currentDv !== undefined && (
                <div className="pt-4 border-t border-white/5">
                   <div className="flex justify-between items-end mb-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Daily Target Progress</span>
                      <span className="text-lg font-black text-[var(--primary)] font-mono">{Math.round(currentDv)}%</span>
                   </div>
                   <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(currentDv, 100)}%` }}
                        className="h-full bg-[var(--primary)] shadow-[0_0_15px_rgba(255,140,0,0.5)]"
                      />
                   </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 pt-0 relative z-10">
               <Button 
                onClick={onClose}
                className="w-full h-14 bg-[var(--primary)] text-white rounded-[20px] font-black uppercase tracking-widest text-xs active:scale-95 shadow-xl shadow-[var(--primary)]/20"
               >
                 Dismiss
               </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
