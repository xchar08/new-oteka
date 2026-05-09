'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Flame, Clock, Microscope } from 'lucide-react';

export type MetabolicRecipe = {
    title: string;
    ingredients: string[];
    instructions: string[];
    bio_reason: string;
    prep_time: string;
};

interface MetabolicRecipeCardProps {
    recipe: MetabolicRecipe;
    isExpanded: boolean;
    onToggle: () => void;
}

/**
 * MetabolicRecipeCard - High-Fidelity Bio-Logistics Component
 * Features: Synthesis Protocols, Bio-Reasoning, and Hardware-style HUD stats.
 */
export function MetabolicRecipeCard({ recipe, isExpanded, onToggle }: MetabolicRecipeCardProps) {
    return (
        <motion.div 
            layout
            className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[2rem] overflow-hidden cursor-pointer active:scale-[0.99] transition-all shadow-sm"
            onClick={onToggle}
        >
            <div className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center border border-[var(--primary)]/20 shrink-0">
                        <Flame size={24} className="text-[var(--primary)]" />
                    </div>
                    <div className="min-w-0">
                        <h4 className="font-bold text-[var(--text-primary)] truncate text-base">{recipe.title}</h4>
                        <div className="flex items-center gap-2 text-[var(--text-secondary)] font-mono text-[9px] font-bold uppercase">
                            <Clock size={10} /> {recipe.prep_time}
                            <div className="w-1 h-1 bg-[var(--border)] rounded-full" />
                            <Microscope size={10} /> Bio-Aligned
                        </div>
                    </div>
                </div>
                <ChevronDown className={`text-[var(--text-secondary)] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-[var(--border)] bg-black/5"
                    >
                        <div className="p-6 space-y-6">
                            <div className="p-4 rounded-2xl bg-[var(--primary)]/5 border border-[var(--primary)]/10 italic text-xs text-[var(--text-primary)] opacity-90 leading-relaxed font-serif">
                                "{recipe.bio_reason}"
                            </div>
                            
                            <div>
                                <h5 className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-3">Target Synthesis Protocols</h5>
                                <div className="space-y-3">
                                    {recipe.instructions.map((step, idx) => (
                                        <div key={idx} className="flex gap-4">
                                            <span className="font-mono text-[10px] font-black text-[var(--primary)] opacity-40">{idx + 1}.</span>
                                            <p className="text-sm font-medium text-[var(--text-primary)] leading-tight">{step}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {recipe.ingredients.map((ing, idx) => (
                                    <span key={idx} className="px-3 py-1.5 bg-[var(--bg-app)] border border-[var(--border)] rounded-full text-[10px] font-bold text-[var(--text-secondary)]">
                                        {ing}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
