'use client';

import { useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, Zap, Target, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useModalA11y } from '@/lib/hooks/useModalA11y';

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
  const dialogRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  // Try to find exact match, or case-insensitive match; unknown nutrients
  // still get a modal (a dead tap is worse than a sparse one)
  const info: NutrientInfo = NUTRIENT_DATABASE[nutrientName] ||
               Object.values(NUTRIENT_DATABASE).find(v => v.name.toLowerCase() === nutrientName.toLowerCase()) ||
               {
                 name: nutrientName,
                 bioOptimizer: 'Detailed reference data for this nutrient is on the way.',
                 benefits: [],
                 sources: [],
                 category: 'other',
               };

  useModalA11y(isOpen, onClose, dialogRef);

  if (!nutrientName) return null;

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
            ref={dialogRef}
            tabIndex={-1}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 16 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="nutrient-modal-title"
            className="fixed inset-x-6 top-[15%] bottom-[15%] max-w-lg mx-auto bg-[var(--bg-surface)] border border-[var(--primary)]/30 rounded-[40px] z-[101] shadow-[0_0_50px_rgba(var(--ring),0.15)] overflow-hidden flex flex-col font-sans focus:outline-none"
          >
            {/* Glass Highlight */}
            <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-[var(--primary)]/5 to-transparent pointer-events-none" />
            
            {/* Header */}
            <div className="p-8 pb-4 flex justify-between items-start relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center border border-[var(--primary)]/20 shadow-inner">
                  <Zap className="text-[var(--primary-text)] w-7 h-7" />
                </div>
                <div>
                   <h2 id="nutrient-modal-title" className="text-3xl font-black tracking-tight text-[var(--text-primary)]">{info.name}</h2>
                   <span className="text-[11px] font-semibold text-[var(--primary-text)] capitalize">
                     {info.category} optimization
                   </span>
                </div>
              </div>
              <button onClick={onClose} aria-label="Close" className="p-2 rounded-full bg-[var(--bg-surface-2)] hover:bg-[var(--border)] transition-colors">
                <X size={20} className="text-[var(--text-secondary)]" />
              </button>
            </div>

            {/* Content */}
            <div className="p-8 pt-0 flex-1 overflow-y-auto space-y-8 relative z-10 scrollbar-hide">
              {/* Summary */}
              <div className="p-5 rounded-3xl bg-[var(--bg-surface-2)] border border-[var(--border)] shadow-sm">
                <p className="text-sm font-medium leading-relaxed text-[var(--text-primary)] italic">
                  "{info.bioOptimizer}"
                </p>
              </div>

              {/* Benefits */}
              {info.benefits.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-[13px] font-semibold text-[var(--primary-text)] flex items-center gap-2">
                  <Target size={14} /> Metabolic wins
                </h3>
                <div className="space-y-3">
                  {info.benefits.map((benefit, i) => (
                    <div key={i} className="flex items-center gap-3 group">
                       <div className="w-2 h-2 rounded-full bg-[var(--primary)] shadow-[0_0_8px_rgba(var(--ring),0.5)]" />
                       <span className="text-sm font-bold text-[var(--text-primary)]">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* Sources */}
              {info.sources.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-[13px] font-semibold text-[var(--primary-text)] flex items-center gap-2">
                  <Lightbulb size={14} /> Prime sources
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {info.sources.map((source, i) => (
                    <div key={i} className="px-4 py-3 rounded-2xl bg-[var(--bg-surface-2)] border border-[var(--border)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]/40" />
                      {source}
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* Progress */}
              {currentDv !== undefined && (
                <div className="pt-4 border-t border-[var(--border)]">
                   <div className="flex justify-between items-end mb-3">
                      <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Daily target progress</span>
                      <span className="text-lg font-black text-[var(--primary-text)] font-mono tabular-nums">{Math.round(currentDv)}%</span>
                   </div>
                   <div className="h-2 w-full bg-[var(--bg-app)] rounded-full overflow-hidden border border-[var(--border)]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(currentDv, 100)}%` }}
                        transition={reduceMotion ? { duration: 0 } : undefined}
                        className="h-full bg-[var(--primary)] shadow-[0_0_15px_rgba(var(--ring),0.5)]"
                      />
                   </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 pt-0 relative z-10">
               <Button
                onClick={onClose}
                className="w-full h-14 bg-[var(--primary)] text-[var(--primary-fg)] rounded-[20px] font-black uppercase tracking-widest text-xs active:scale-95 shadow-xl shadow-[var(--primary)]/20"
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
