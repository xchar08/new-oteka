'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence, Variants, useReducedMotion } from 'framer-motion';
import { ChevronDown, Flame, Utensils, RefreshCw, Pencil, Trash2, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { NutrientSection } from '@/components/ui/NutrientSection';
import { useLogFeedback } from '@/lib/hooks/useLogFeedback';
import { useLogMutations } from '@/lib/hooks/useLogMutations';
import { useEditingLogs } from '@/lib/state/editingLogs';
import type { LogEntry, LogMetadata } from '@/lib/types/metabolic';

interface NutrientDraft { name: string; amount: string; daily_value_pct?: number }

interface EditDraft {
  name: string;
  grams: string;
  calories: string; protein: string; carbs: string; fats: string;
  fiber: string; sugar: string; sodium: string; cholesterol: string;
  vitamins: NutrientDraft[];
  minerals: NutrientDraft[];
}

const EXACT_FIELDS: { key: keyof Pick<EditDraft, 'calories' | 'protein' | 'carbs' | 'fats' | 'fiber' | 'sugar' | 'sodium' | 'cholesterol'>; label: string }[] = [
  { key: 'calories', label: 'Calories (kcal)' },
  { key: 'protein', label: 'Protein (g)' },
  { key: 'carbs', label: 'Carbs (g)' },
  { key: 'fats', label: 'Fats (g)' },
  { key: 'fiber', label: 'Fiber (g)' },
  { key: 'sugar', label: 'Sugar (g)' },
  { key: 'sodium', label: 'Sodium (mg)' },
  { key: 'cholesterol', label: 'Chol. (mg)' },
];

const numStr = (v: unknown) => String(Math.round((Number(v) || 0) * 10) / 10);
const parseNum = (s: string) => Math.max(0, parseFloat(s) || 0);
const scaleStr = (s: string, ratio: number) => String(Math.round(parseNum(s) * ratio * 10) / 10);

interface LogEntryCardProps {
  log: LogEntry;
}

/**
 * LogEntryCard - Elite Biological Diagnostic Component
 * Features: Deep Glassmorphism, Precision Feedback Sliders, Metabolic Data Density.
 */
export function LogEntryCard({ log }: LogEntryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const reduceMotion = useReducedMotion();

  const itemVariants = useMemo<Variants>(() => (
    reduceMotion
      ? { hidden: { opacity: 1 }, visible: { opacity: 1 }, show: { opacity: 1 } }
      : {
          hidden: { opacity: 0, y: 12 },
          visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
          show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
        }
  ), [reduceMotion]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Smart intersection to handle both flattened (new) and wrapped (legacy) metadata
  const meta = (log.metabolic_tags_json || {}) as LogMetadata & { macros?: any; feedback?: any; food_name?: string };
  const macros = meta.macros || meta; 
  
  const name = meta.food_name || meta.item || 'Unknown Food';
  const time = mounted 
    ? new Date(log.captured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '--:--';
  const ingredients = meta.ingredients || [];
  const vitamins = meta.vitamins || [];
  const minerals = meta.minerals || [];
  const micros = meta.micros || [];

  // Feedback State (NSGA-II Fitness Weights)
  const { feedback, setFeedback, isSubmitting, hasFeedback, submitFeedback, unlock } = useLogFeedback(log.id, meta);

  const isOptimistic = (log.metabolic_tags_json as any)?.isOptimistic;
  const editedAt = (meta as { edited_at?: string }).edited_at;

  // -- Edit mode --
  const { updateLog, deleteLogWithUndo } = useLogMutations();
  const beginEditing = useEditingLogs((s) => s.begin);
  const endEditing = useEditingLogs((s) => s.end);
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [showExact, setShowExact] = useState(false);
  const [factor, setFactor] = useState(1);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [nameError, setNameError] = useState(false);
  const initialDraftRef = useRef<string>('');
  const escArmedAt = useRef(0);

  // Register with the editing store so containers can guard state changes
  // that would unmount this card; cleanup covers every exit path
  useEffect(() => {
    if (!isEditing) return;
    beginEditing();
    return () => endEditing();
  }, [isEditing, beginEditing, endEditing]);

  const beginEdit = () => {
    setDraft({
      name,
      grams: String(Math.round(Number(log.grams) || 0)),
      calories: numStr(macros.calories),
      protein: numStr(macros.protein),
      carbs: numStr(macros.carbs),
      fats: numStr(macros.fats ?? macros.fat),
      fiber: numStr(macros.fiber),
      sugar: numStr(macros.sugar),
      sodium: numStr(macros.sodium),
      cholesterol: numStr(macros.cholesterol),
      vitamins: (vitamins as NutrientDraft[]).map((v) => ({ name: v.name, amount: String(v.amount ?? ''), daily_value_pct: v.daily_value_pct })),
      minerals: (minerals as NutrientDraft[]).map((v) => ({ name: v.name, amount: String(v.amount ?? ''), daily_value_pct: v.daily_value_pct })),
    });
    setFactor(1);
    setShowExact(false);
    setNameError(false);
    setIsEditing(true);
    setExpanded(true);
    escArmedAt.current = 0;
    // Hand keyboard focus into the form; the Edit button is about to unmount
    requestAnimationFrame(() => document.getElementById(`meal-name-${log.id}`)?.focus());
  };

  // Snapshot for the dirty check, captured after the draft state settles
  useEffect(() => {
    if (isEditing && draft && !initialDraftRef.current) {
      initialDraftRef.current = JSON.stringify(draft);
    }
    if (!isEditing) initialDraftRef.current = '';
  }, [isEditing, draft]);

  const restoreFocusToManageRow = () => {
    requestAnimationFrame(() => document.getElementById(`edit-meal-${log.id}`)?.focus());
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setDraft(null);
    restoreFocusToManageRow();
  };

  useEffect(() => {
    if (!isEditing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const dirty = initialDraftRef.current && JSON.stringify(draft) !== initialDraftRef.current;
      if (!dirty) {
        cancelEdit();
        return;
      }
      // Dirty draft: arm Esc instead of discarding real work instantly
      const now = Date.now();
      if (now - escArmedAt.current < 4000) {
        cancelEdit();
      } else {
        escArmedAt.current = now;
        toast('Unsaved changes — press Esc again to discard');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, draft]);

  // Portion stepper scales every numeric value from its current state, so
  // hand-edited exact values become the new base
  const stepFactor = (dir: -1 | 1) => {
    if (!draft) return;
    const next = Math.min(10, Math.max(0.25, Math.round((factor + dir * 0.25) * 100) / 100));
    if (next === factor) return;
    const ratio = next / factor;
    setFactor(next);
    setDraft({
      ...draft,
      grams: String(Math.round(parseNum(draft.grams) * ratio)),
      calories: scaleStr(draft.calories, ratio),
      protein: scaleStr(draft.protein, ratio),
      carbs: scaleStr(draft.carbs, ratio),
      fats: scaleStr(draft.fats, ratio),
      fiber: scaleStr(draft.fiber, ratio),
      sugar: scaleStr(draft.sugar, ratio),
      sodium: scaleStr(draft.sodium, ratio),
      cholesterol: scaleStr(draft.cholesterol, ratio),
      vitamins: draft.vitamins.map((v) => ({ ...v, daily_value_pct: v.daily_value_pct != null ? Math.round(v.daily_value_pct * ratio) : v.daily_value_pct })),
      minerals: draft.minerals.map((v) => ({ ...v, daily_value_pct: v.daily_value_pct != null ? Math.round(v.daily_value_pct * ratio) : v.daily_value_pct })),
    });
  };

  const saveEdit = async () => {
    if (!draft) return;
    const trimmedName = draft.name.trim();
    if (!trimmedName) {
      setNameError(true);
      return;
    }
    const numbers = {
      calories: parseNum(draft.calories),
      protein: parseNum(draft.protein),
      carbs: parseNum(draft.carbs),
      fats: parseNum(draft.fats),
      fat: parseNum(draft.fats),
      fiber: parseNum(draft.fiber),
      sugar: parseNum(draft.sugar),
      sodium: parseNum(draft.sodium),
      cholesterol: parseNum(draft.cholesterol),
    };
    // Plain numeric amounts save as numbers (avoids type drift in the DB);
    // amounts with units ("12 mg") stay strings
    const normalizeAmount = (s: string): string | number =>
      /^\d*\.?\d+$/.test(s.trim()) ? Number(s.trim()) : s;
    const mergeNutrients = (original: NutrientDraft[], edited: NutrientDraft[]) =>
      edited.map((v, i) => ({ ...(original[i] || {}), name: v.name, amount: normalizeAmount(v.amount), daily_value_pct: v.daily_value_pct }));

    const baseTags = { ...(log.metabolic_tags_json as Record<string, unknown>) };
    const common = {
      food_name: trimmedName,
      item: trimmedName,
      edited_at: new Date().toISOString(),
      vitamins: mergeNutrients(vitamins as NutrientDraft[], draft.vitamins),
      minerals: mergeNutrients(minerals as NutrientDraft[], draft.minerals),
    };
    // Legacy entries wrap macros in tags.macros; new entries are flat
    const tags: Record<string, unknown> = (baseTags as { macros?: Record<string, unknown> }).macros
      ? { ...baseTags, ...common, macros: { ...(baseTags as { macros: Record<string, unknown> }).macros, ...numbers } }
      : { ...baseTags, ...common, ...numbers };

    setIsSavingEdit(true);
    try {
      await updateLog(log, { grams: Math.round(parseNum(draft.grams)), metabolic_tags_json: tags });
      setIsEditing(false);
      setDraft(null);
      restoreFocusToManageRow();
    } catch { /* hook showed the toast; keep the form open with values intact */ }
    finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <motion.div
      layout
      variants={itemVariants}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
      transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
      className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl shadow-sm overflow-hidden relative"
    >
      {/* Kinetic Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)]/5 to-transparent opacity-30 pointer-events-none" />

      <button
        type="button"
        aria-expanded={expanded}
        className="w-full text-left p-4 flex gap-4 active:scale-[0.99] transition-transform relative z-10"
        onClick={() => { if (!isEditing) setExpanded(!expanded); }}
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
              <div className="flex items-center gap-2 max-w-[70%]">
                <h4 className="font-bold text-[var(--text-primary)] leading-tight capitalize truncate">{name}</h4>
                {isOptimistic && (
                  <RefreshCw size={12} className="text-[var(--primary)] animate-spin shrink-0" />
                )}
              </div>
              <ChevronDown size={16} className={`text-[var(--text-secondary)] transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-[11px] font-bold text-[var(--primary-text)] font-mono tabular-nums">
                {isOptimistic ? 'Syncing...' : time}
              </p>
              {editedAt && !isOptimistic && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--text-secondary)]">
                  <Pencil size={9} aria-hidden="true" /> Edited
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-4">
            <div className="text-[10px] font-bold text-[var(--text-primary)] flex flex-col font-mono tabular-nums">
              <span className="text-[var(--text-secondary)]">P</span>
              <span>{Number(macros.protein || 0).toFixed(0)}g</span>
            </div>
            <div className="text-[10px] font-bold text-[var(--text-primary)] flex flex-col font-mono tabular-nums">
              <span className="text-[var(--text-secondary)]">C</span>
              <span>{Number(macros.carbs || 0).toFixed(0)}g</span>
            </div>
            <div className="text-[10px] font-bold text-[var(--text-primary)] flex flex-col font-mono tabular-nums">
              <span className="text-[var(--text-secondary)]">F</span>
              <span>{Number(macros.fats || macros.fat || 0).toFixed(0)}g</span>
            </div>
            <div className="ml-auto text-right font-mono tabular-nums">
              <span className="text-xs font-black text-[var(--text-primary)]">{Number(macros.calories || 0).toFixed(0)}</span>
              <span className="text-[10px] font-bold text-[var(--text-secondary)] block">kcal</span>
            </div>
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' }}
            className="border-t border-[var(--border)] relative z-10"
          >
            {isEditing && draft ? (
            <div className="p-5 bg-[var(--bg-app)]/50 space-y-5">
              {/* Name */}
              <div>
                <label htmlFor={`meal-name-${log.id}`} className="text-[11px] font-semibold text-[var(--text-secondary)]">Meal name</label>
                <input
                  id={`meal-name-${log.id}`}
                  value={draft.name}
                  onChange={(e) => { setDraft({ ...draft, name: e.target.value }); if (nameError) setNameError(false); }}
                  className="mt-1 flex h-12 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface-2)] px-4 text-sm font-medium text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
                />
                {nameError && <p className="text-[11px] font-medium text-[var(--error-text)] mt-1">Give this meal a name.</p>}
              </div>

              {/* Portion */}
              <div>
                <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Portion</span>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => stepFactor(-1)}
                    disabled={factor <= 0.25}
                    aria-label="Decrease portion"
                    className="w-11 h-11 rounded-xl bg-[var(--bg-surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--text-primary)] active:scale-95 transition-transform disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Minus size={16} />
                  </button>
                  <div className="text-center">
                    <span className="font-mono text-lg font-bold tabular-nums text-[var(--text-primary)]">{factor}×</span>
                    <span className="block text-[10px] text-[var(--text-secondary)] font-mono tabular-nums">{Math.round(parseNum(draft.grams))} g</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => stepFactor(1)}
                    disabled={factor >= 10}
                    aria-label="Increase portion"
                    className="w-11 h-11 rounded-xl bg-[var(--bg-surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--text-primary)] active:scale-95 transition-transform disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <p className="text-[10px] text-[var(--text-secondary)] mt-1.5 text-center">Scales calories, macros, and daily values proportionally.</p>
              </div>

              {/* Exact nutrients (progressive disclosure) */}
              <div>
                <button
                  type="button"
                  aria-expanded={showExact}
                  onClick={() => setShowExact((v) => !v)}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--primary-text)]"
                >
                  <ChevronDown size={14} className={`transition-transform duration-200 ${showExact ? 'rotate-180' : ''}`} aria-hidden="true" />
                  Edit exact nutrients
                </button>
                {showExact && (
                  <div className="mt-3 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {EXACT_FIELDS.map((f) => (
                        <div key={f.key}>
                          <label htmlFor={`${f.key}-${log.id}`} className="text-[11px] font-medium text-[var(--text-secondary)]">{f.label}</label>
                          <input
                            id={`${f.key}-${log.id}`}
                            inputMode="decimal"
                            value={draft[f.key]}
                            onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                            className="mt-1 h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface-2)] px-3 text-sm font-mono tabular-nums text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
                          />
                        </div>
                      ))}
                    </div>
                    {draft.vitamins.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-[var(--text-secondary)] mb-2">Vitamins</p>
                        <div className="space-y-2">
                          {draft.vitamins.map((v, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-[11px] font-medium text-[var(--text-primary)] flex-1 truncate">{v.name}</span>
                              <input
                                aria-label={`${v.name} amount`}
                                value={v.amount}
                                onChange={(e) => setDraft({ ...draft, vitamins: draft.vitamins.map((x, xi) => xi === i ? { ...x, amount: e.target.value } : x) })}
                                className="h-10 w-28 rounded-lg border border-[var(--border)] bg-[var(--bg-surface-2)] px-3 text-xs font-mono text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {draft.minerals.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-[var(--text-secondary)] mb-2">Minerals</p>
                        <div className="space-y-2">
                          {draft.minerals.map((v, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-[11px] font-medium text-[var(--text-primary)] flex-1 truncate">{v.name}</span>
                              <input
                                aria-label={`${v.name} amount`}
                                value={v.amount}
                                onChange={(e) => setDraft({ ...draft, minerals: draft.minerals.map((x, xi) => xi === i ? { ...x, amount: e.target.value } : x) })}
                                className="h-10 w-28 rounded-lg border border-[var(--border)] bg-[var(--bg-surface-2)] px-3 text-xs font-mono text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Save / Cancel */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={isSavingEdit}
                  className="flex-1 h-11 bg-[var(--primary)] text-[var(--primary-fg)] rounded-xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-transform disabled:opacity-50"
                >
                  {isSavingEdit ? 'Saving...' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="h-11 px-4 rounded-xl text-[11px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
            ) : (
            <div className="p-5 bg-[var(--bg-app)]/50 space-y-5">

              {/* METABOLIC FEEDBACK WIDGET - REFINE: Hardware Instrument Style */}
              <div className="bg-[var(--bg-surface)] border border-[var(--primary)]/20 p-4 rounded-2xl shadow-[0_0_15px_rgba(var(--ring),0.08)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--primary)]/5 rounded-full blur-2xl pointer-events-none" />
                <h4 className="text-[13px] font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <Flame size={12} className="text-[var(--primary-text)]" />
                  Metabolic calibration
                </h4>
                
                <div className="space-y-4 relative z-10">
                  {/* Taste */}
                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-[var(--text-secondary)] mb-2 font-mono tabular-nums">
                      <span>Flavor profile</span>
                      <span className="text-[var(--primary-text)]">{feedback.taste}/5</span>
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
                    <div className="flex justify-between text-[11px] font-semibold text-[var(--text-secondary)] mb-2 font-mono">
                      <span>Satiety index</span>
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
                    <div className="flex justify-between text-[11px] font-semibold text-[var(--text-secondary)] mb-2 font-mono">
                      <span>Digestion</span>
                      <span>{feedback.digestion < 3 ? 'Reactive' : feedback.digestion > 3 ? 'Peak' : 'Normal'}</span>
                    </div>
                    <input 
                      type="range" min="1" max="5" step="1" 
                      value={feedback.digestion} onChange={(e) => setFeedback({...feedback, digestion: parseInt(e.target.value)})}
                      disabled={hasFeedback}
                      className="w-full h-1 bg-[var(--bg-app)] rounded-full appearance-none accent-[var(--primary)] cursor-pointer"
                    />
                  </div>

                  {!hasFeedback && !isOptimistic && (
                    <button
                      onClick={submitFeedback}
                      disabled={isSubmitting}
                      className="w-full py-3 mt-2 bg-[var(--primary)] text-[var(--primary-fg)] hover:brightness-110 transition-all shadow-[0_0_20px_rgba(var(--ring),0.3)] rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Syncing...' : 'Calibrate Engine'}
                    </button>
                  )}
                  {hasFeedback && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 py-2 text-center text-[11px] font-bold text-[var(--success-text)] bg-[var(--success)]/10 rounded-xl border border-[var(--success)]/30 font-mono">
                        Model optimized
                      </div>
                      <button
                        type="button"
                        onClick={unlock}
                        className="h-9 px-3 rounded-xl text-[11px] font-bold text-[var(--primary-text)] active:scale-95 transition-transform"
                      >
                        Edit rating
                      </button>
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
                      <div className="text-[11px] font-medium text-[var(--text-secondary)] mb-0.5">{m.label}</div>
                      <div className="text-xs font-bold text-[var(--text-primary)] font-mono tabular-nums">{Math.round(Number(m.val) || 0)}<span className="text-[10px] text-[var(--text-secondary)] ml-0.5">{m.unit}</span></div>
                    </div>
                  ))}
                </div>
              )}

              {/* Molecular Scaffolding */}
              {ingredients.length > 0 && (
                <div>
                  <h4 className="text-[13px] font-semibold text-[var(--text-secondary)] mb-3 ml-1">Ingredients</h4>
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
                <p className="text-sm text-[var(--text-secondary)] italic px-1">No micronutrient data available.</p>
              )}

              {/* Manage */}
              {!isOptimistic ? (
                <div className="flex items-center gap-2 pt-4 border-t border-[var(--border)]">
                  <button
                    type="button"
                    id={`edit-meal-${log.id}`}
                    onClick={beginEdit}
                    className="flex-1 h-11 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl text-[11px] font-bold text-[var(--text-primary)] active:scale-95 transition-transform inline-flex items-center justify-center gap-2"
                  >
                    <Pencil size={12} aria-hidden="true" /> Edit meal
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteLogWithUndo(log)}
                    className="h-11 px-4 rounded-xl text-[11px] font-bold text-[var(--error-text)] active:scale-95 transition-transform inline-flex items-center gap-2"
                  >
                    <Trash2 size={12} aria-hidden="true" /> Delete
                  </button>
                </div>
              ) : (
                <p className="pt-4 border-t border-[var(--border)] text-[11px] font-medium text-[var(--text-secondary)] text-center">
                  Waiting to sync — editing is available once saved
                </p>
              )}
            </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
