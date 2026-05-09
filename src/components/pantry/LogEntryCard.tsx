'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { ChevronDown, Flame, Utensils } from 'lucide-react';
import { visionService } from '@/lib/services/vision.service';
import { NutrientSection } from '@/components/ui/NutrientSection';
import type { LogEntry, LogMetadata } from '@/lib/types/metabolic';

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: 'spring', stiffness: 100 }
  }
};

interface LogEntryCardProps {
  log: LogEntry;
}

/**
 * LogEntryCard - Elite Biological Diagnostic Component
 * Features: Deep Glassmorphism, Precision Feedback Sliders, Metabolic Data Density.
 */
export function LogEntryCard({ log }: LogEntryCardProps) {
  const [expanded, setExpanded] = useState(false);
  // Smart intersection to handle both flattened (new) and wrapped (legacy) metadata
  const meta = (log.metabolic_tags_json || {}) as LogMetadata & { macros?: any; feedback?: any; food_name?: string };
  const macros = meta.macros || meta; 
  
  const name = meta.food_name || meta.item || 'Unknown Food';
  const time = new Date(log.captured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const ingredients = meta.ingredients || [];
  const vitamins = meta.vitamins || [];
  const minerals = meta.minerals || [];
  const micros = meta.micros || [];

  // Feedback State (NSGA-II Fitness Weights)
  const [feedback, setFeedback] = useState(meta.feedback || { taste: 3, satiety: 3, digestion: 3 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasFeedback, setHasFeedback] = useState(!!meta.feedback);

  const handleFeedbackSubmit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSubmitting(true);
    try {
      await visionService.updateLogFeedback(log.id!, meta, feedback);
      setHasFeedback(true);
    } catch (e) {
      console.error("Failed to calibrate algorithm", e);
    }
    setIsSubmitting(false);
  };

  return (
    <motion.div 
      layout 
      variants={itemVariants} 
      className="bg-[var(--bg-surface)]/60 backdrop-blur-xl rounded-[24px] shadow-sm border border-[var(--border)] overflow-hidden relative"
    >
      {/* Kinetic Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)]/5 to-transparent opacity-30 pointer-events-none" />

      <div 
        className="p-4 flex gap-4 cursor-pointer active:scale-[0.99] transition-transform relative z-10"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-inner bg-[var(--bg-app)] flex items-center justify-center border border-[var(--border)]">
          {log.image_url ? (
            <img src={log.image_url} alt={name} className="w-full h-full object-cover" />
          ) : (
            <Utensils size={32} className="text-[var(--text-secondary)] opacity-10" />
          )}
        </div>
        <div className="flex-1 py-1 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex justify-between items-start">
              <h4 className="font-bold text-[var(--text-primary)] leading-tight capitalize truncate w-[70%]">{name}</h4>
              <ChevronDown size={16} className={`text-[var(--text-secondary)] opacity-30 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
            </div>
            <p className="text-[10px] font-bold uppercase text-[var(--primary)] mt-1 tracking-wider font-mono">{time}</p>
          </div>
          <div className="flex gap-4">
            <div className="text-[10px] font-bold text-[var(--text-primary)] flex flex-col font-mono">
              <span className="text-[var(--text-secondary)] opacity-40">P</span>
              <span>{Number(macros.protein || 0).toFixed(0)}g</span>
            </div>
            <div className="text-[10px] font-bold text-[var(--text-primary)] flex flex-col font-mono">
              <span className="text-[var(--text-secondary)] opacity-40">C</span>
              <span>{Number(macros.carbs || 0).toFixed(0)}g</span>
            </div>
            <div className="text-[10px] font-bold text-[var(--text-primary)] flex flex-col font-mono">
              <span className="text-[var(--text-secondary)] opacity-40">F</span>
              <span>{Number(macros.fats || macros.fat || 0).toFixed(0)}g</span>
            </div>
            <div className="ml-auto text-right font-mono">
              <span className="text-xs font-black text-[var(--text-primary)]">{Number(macros.calories || 0).toFixed(0)}</span>
              <span className="text-[8px] font-bold text-[var(--text-secondary)] opacity-40 block uppercase">kcal</span>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-[var(--border)] relative z-10"
          >
            <div className="p-5 bg-[var(--bg-app)]/50 space-y-5">
              
              {/* METABOLIC FEEDBACK WIDGET - REFINE: Hardware Instrument Style */}
              <div className="bg-[var(--bg-surface)] border border-[var(--primary)]/20 p-4 rounded-2xl shadow-[0_0_15px_rgba(255,140,0,0.05)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--primary)]/5 rounded-full blur-2xl pointer-events-none" />
                <h4 className="text-[10px] uppercase tracking-widest font-black text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <Flame size={12} className="text-[var(--primary)]" />
                  Metabolic Calibration
                </h4>
                
                <div className="space-y-4 relative z-10">
                  {/* Taste */}
                  <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-2 font-mono">
                      <span>Flavor Profile</span>
                      <span className="text-[var(--primary)]">{feedback.taste}/5</span>
                    </div>
                    <input 
                      type="range" min="1" max="5" step="1" 
                      value={feedback.taste} onChange={(e) => setFeedback({...feedback, taste: parseInt(e.target.value)})}
                      disabled={hasFeedback}
                      className="w-full h-1 bg-[var(--bg-app)] rounded-full appearance-none accent-[var(--primary)] cursor-pointer"
                    />
                  </div>

                  {/* Satiety */}
                  <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-2 font-mono">
                      <span>Satiety Index</span>
                      <span>{feedback.satiety < 3 ? 'Low' : feedback.satiety > 3 ? 'High' : 'Optimal'}</span>
                    </div>
                    <input 
                      type="range" min="1" max="5" step="1" 
                      value={feedback.satiety} onChange={(e) => setFeedback({...feedback, satiety: parseInt(e.target.value)})}
                      disabled={hasFeedback}
                      className="w-full h-1 bg-[var(--bg-app)] rounded-full appearance-none accent-[var(--primary)] cursor-pointer"
                    />
                  </div>

                  {/* Digestion */}
                  <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-2 font-mono">
                      <span>Bio-Efficiency</span>
                      <span>{feedback.digestion < 3 ? 'Reactive' : feedback.digestion > 3 ? 'Peak' : 'Normal'}</span>
                    </div>
                    <input 
                      type="range" min="1" max="5" step="1" 
                      value={feedback.digestion} onChange={(e) => setFeedback({...feedback, digestion: parseInt(e.target.value)})}
                      disabled={hasFeedback}
                      className="w-full h-1 bg-[var(--bg-app)] rounded-full appearance-none accent-[var(--primary)] cursor-pointer"
                    />
                  </div>

                  {!hasFeedback && (
                    <button 
                      onClick={handleFeedbackSubmit}
                      disabled={isSubmitting}
                      className="w-full py-3 mt-2 bg-[var(--primary)] text-white hover:brightness-110 transition-all shadow-[0_0_20px_rgba(255,140,0,0.3)] rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95"
                    >
                      {isSubmitting ? 'Syncing...' : 'Calibrate Engine'}
                    </button>
                  )}
                  {hasFeedback && (
                    <div className="w-full py-2 mt-2 text-center text-[10px] font-bold uppercase text-green-500 tracking-widest bg-green-500/10 rounded-xl border border-green-500/30 font-mono">
                      Model Optimized
                    </div>
                  )}
                </div>
              </div>

              {/* Extended Macros */}
              {(macros.fiber > 0 || macros.sugar > 0 || macros.sodium > 0 || macros.cholesterol > 0) && (
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Fiber', val: macros.fiber, unit: 'g' },
                    { label: 'Sugar', val: macros.sugar, unit: 'g' },
                    { label: 'Sodium', val: macros.sodium, unit: 'mg' },
                    { label: 'Chol.', val: macros.cholesterol, unit: 'mg' },
                  ].map(m => (
                    <div key={m.label} className="bg-[var(--bg-surface)] border border-[var(--border)] p-2.5 rounded-xl text-center shadow-sm">
                      <div className="text-[8px] font-black uppercase text-[var(--text-secondary)] tracking-widest mb-0.5 opacity-40 font-mono">{m.label}</div>
                      <div className="text-xs font-bold text-[var(--text-primary)] font-mono">{Math.round(Number(m.val) || 0)}<span className="text-[8px] opacity-30 ml-0.5">{m.unit}</span></div>
                    </div>
                  ))}
                </div>
              )}

              {/* Molecular Scaffolding */}
              {ingredients.length > 0 && (
                <div>
                  <h4 className="text-[9px] uppercase tracking-widest font-black text-[var(--text-secondary)] mb-3 ml-1">Molecular Scaffolding</h4>
                  <div className="space-y-2">
                    {ingredients.map((ing: any, i: number) => {
                      const ingName = ing.name || ing;
                      const ratio = ing.ratio != null ? `${Math.round(ing.ratio * 100)}%` : null;
                      return (
                        <div key={i} className="flex justify-between items-center px-1">
                          <span className="text-sm text-[var(--text-primary)] font-medium capitalize">{ingName}</span>
                          {ratio && <span className="text-sm text-[var(--text-secondary)] font-bold tabular-nums font-mono">{ratio}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Categorized Nutrients */}
              <div className="space-y-4">
                <NutrientSection title="Vitamins" items={vitamins} />
                <NutrientSection title="Minerals" items={minerals} />
                <NutrientSection title="Other Nutrients" items={micros} />
              </div>

              {/* Fallback if nothing */}
              {vitamins.length === 0 && minerals.length === 0 && micros.length === 0 && (
                <p className="text-sm text-[var(--text-secondary)] italic opacity-50 px-1">No micronutrient data available.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
