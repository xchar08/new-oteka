'use client';

import { useState, useEffect, useMemo, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  Camera, ShoppingCart as ShoppingCartIcon, Sparkles, Flame, Target,
  Zap, Droplets, ChevronLeft, ChevronRight, User, Lock,
  Settings, Clock, Crown, Calendar, Utensils, Plus, WifiOff, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence, Variants, useReducedMotion } from 'framer-motion';
import { toast } from 'sonner';
import { BottomNav } from '@/components/layout/BottomNav';
import { useEditingLogs } from '@/lib/state/editingLogs';
import { useRouter } from 'next/navigation';
import { useConnectionMode } from '@/lib/hooks/useConnectionMode';
import { useUser } from '@/lib/hooks/useUser';
import { useMetabolicLogs } from '@/lib/hooks/useMetabolicLogs';
import { useWeekLogs } from '@/lib/hooks/useWeekLogs';
import { ProUpgradeDialog } from '@/components/ui/ProUpgradeDialog';
import { PricingGuard } from '@/components/ui/PricingGuard';
import { createClient } from '@/lib/supabase/client';

import { LogEntryCard } from '@/components/pantry/LogEntryCard';
import { aggregateNutrients, extractLogStats } from '@/lib/utils/metabolic.utils';
import { isPaidPlan } from '@/lib/utils/plan';
import { NutrientInfoModal } from '@/components/ui/NutrientInfoModal';
import type { LogEntry } from '@/lib/types/metabolic';

const TABS = ['hub', 'logs', 'insights'] as const;
type DashboardTab = (typeof TABS)[number];

// Week identity for the date strip: timestamp of the Monday this date belongs to
function mondayOf(d: Date): number {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day + (day === 0 ? -6 : 1));
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

// Calendar-day arithmetic via setDate, never fixed-86400000ms math:
// across DST changes a "day" isn't 24h and ms-addition drifts into the
// wrong week once mondayOf re-normalizes it
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// Initial selected day: URL ?date= wins (deep link), sessionStorage is the
// interruption fallback, today otherwise. Pure read; safe to call twice.
function resolveInitialDate(): Date {
  if (typeof window === 'undefined') return new Date();
  const param = new URLSearchParams(window.location.search).get('date');
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) {
    const [y, m, d] = param.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (!isNaN(dt.getTime())) return dt;
  }
  try {
    const saved = window.sessionStorage.getItem('oteka.dashboard.date');
    if (saved) {
      const dt = new Date(saved);
      if (!isNaN(dt.getTime())) return dt;
    }
  } catch { /* sessionStorage unavailable (private mode) */ }
  return new Date();
}

// "Jun 8–14", "Dec 29 – Jan 4", with years appended when not the current year
function weekRangeLabel(start: Date): string {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const mon = (d: Date) => d.toLocaleDateString('en-US', { month: 'short' });
  const nowYear = new Date().getFullYear();
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const base = sameMonth
    ? `${mon(start)} ${start.getDate()}–${end.getDate()}`
    : `${mon(start)} ${start.getDate()} – ${mon(end)} ${end.getDate()}`;
  if (start.getFullYear() === nowYear && end.getFullYear() === nowYear) return base;
  if (start.getFullYear() === end.getFullYear()) return `${base}, ${start.getFullYear()}`;
  return `${mon(start)} ${start.getDate()}, ${start.getFullYear()} – ${mon(end)} ${end.getDate()}, ${end.getFullYear()}`;
}

export default function DashboardPage() {
  useConnectionMode();
  const { user, loading: userLoading } = useUser();
  const { dailyMacros, advice, adviceError, dailyLogs = [], loading: logsLoading, logsError, refetchLogs } = useMetabolicLogs();
  const loading = userLoading || logsLoading;
  const router = useRouter();
  const supabase = createClient();
  const reduceMotion = useReducedMotion();

  // Entrance variants honor prefers-reduced-motion; crisp ease-out, no spring overshoot
  const { container, item } = useMemo<{ container: Variants; item: Variants }>(() => {
    if (reduceMotion) {
      return {
        container: { hidden: { opacity: 1 }, show: { opacity: 1 } },
        item: { hidden: { opacity: 1 }, show: { opacity: 1 } },
      };
    }
    return {
      container: { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } } },
      item: { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } } },
    };
  }, [reduceMotion]);

  // Tab survives interruptions via ?tab= (sessionStorage-free, deep-linkable).
  // history.replaceState instead of useSearchParams: this app static-exports
  // for Capacitor, and replaceState avoids the Suspense-boundary requirement.
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => {
    if (typeof window === 'undefined') return 'hub';
    const t = new URLSearchParams(window.location.search).get('tab');
    return (TABS as readonly string[]).includes(t || '') ? (t as DashboardTab) : 'hub';
  });

  // Refuse view changes that would unmount a card with an open edit form
  const editingCount = useEditingLogs((s) => s.count);
  const guardEditing = () => {
    if (editingCount === 0) return false;
    toast('Finish editing your meal first', { description: 'Save or cancel your changes to switch views.' });
    return true;
  };

  const selectTab = (tab: DashboardTab) => {
    if (guardEditing()) return;
    setActiveTab(tab);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (tab === 'hub') url.searchParams.delete('tab');
    else url.searchParams.set('tab', tab);
    window.history.replaceState(window.history.state, '', url);
  };

  const handleTabKeyDown = (e: ReactKeyboardEvent) => {
    const idx = TABS.indexOf(activeTab);
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (idx + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (idx + TABS.length - 1) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    if (next === null) return;
    e.preventDefault();
    const tab = TABS[next];
    selectTab(tab);
    document.getElementById(`dashboard-tab-${tab}`)?.focus();
  };

  // -- Logs State --
  // Selected day + visible week survive interruptions (URL/sessionStorage)
  const [selectedDate, setSelectedDateState] = useState(resolveInitialDate);
  const [weekStart, setWeekStart] = useState(() => new Date(mondayOf(resolveInitialDate())));
  const [showUpgrade, setShowUpgrade] = useState(false);

  const setSelectedDate = (d: Date) => {
    setSelectedDateState(d);
    try { window.sessionStorage.setItem('oteka.dashboard.date', d.toISOString()); } catch { /* non-fatal */ }
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const ds = d.toLocaleDateString('en-CA');
    if (ds === new Date().toLocaleDateString('en-CA')) url.searchParams.delete('date');
    else url.searchParams.set('date', ds);
    window.history.replaceState(window.history.state, '', url);
  };

  const isProUser = isPaidPlan(user?.plan);
  const currentWeekMonday = mondayOf(new Date());
  const weekStartTime = mondayOf(weekStart);
  const isCurrentWeek = weekStartTime === currentWeekMonday;
  const freeLimitMonday = mondayOf(addDays(new Date(currentWeekMonday), -7));
  // Free tier reaches the current week + one back; the lock shows when the
  // next back-page would cross that line
  const atFreeBoundary = !isProUser && weekStartTime === freeLimitMonday;

  // Deep links / restored state beyond the free boundary fall back to today
  useEffect(() => {
    if (userLoading || !user || isPaidPlan(user.plan)) return;
    if (mondayOf(weekStart) < freeLimitMonday) {
      const today = new Date();
      setWeekStart(new Date(mondayOf(today)));
      setSelectedDate(today);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoading, user]);

  const goToday = () => {
    if (guardEditing()) return;
    const today = new Date();
    setWeekStart(new Date(mondayOf(today)));
    setSelectedDate(today);
  };

  const pageWeek = (dir: -1 | 1) => {
    if (guardEditing()) return;
    if (dir === 1 && isCurrentWeek) return;
    const targetMonday = mondayOf(addDays(new Date(weekStartTime), dir * 7));
    if (dir === -1 && !isProUser && targetMonday < freeLimitMonday) {
      setShowUpgrade(true);
      return;
    }
    // Keep the same weekday selected across weeks; clamp to today when
    // returning to the current week would land on a future day
    const dayIndex = Math.round((new Date(selectedDate).setHours(0, 0, 0, 0) - mondayOf(selectedDate)) / 86400000);
    let nextSelected = addDays(new Date(targetMonday), dayIndex);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (targetMonday === currentWeekMonday && nextSelected.getTime() > today.getTime()) nextSelected = today;
    setWeekStart(new Date(targetMonday));
    setSelectedDate(nextSelected);
  };

  // Only fetch week data once the Logs tab is actually open
  const { weekLogs, loading: weekLoading, error: weekError, refetch: refetchWeek } = useWeekLogs(weekStart, activeTab === 'logs');
  const [selectedNutrient, setSelectedNutrient] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const weekDates = useMemo(() => {
    if (!mounted) return [];
    return Array.from({ length: 7 }, (_, i) => {
        const d = addDays(new Date(weekStartTime), i);
        return {
          fullDate: d,
          dateString: d.toLocaleDateString('en-CA'),
          day: d.toLocaleDateString('en-US', { weekday: 'short' }),
          date: d.getDate().toString(),
        };
      });
  }, [mounted, weekStartTime]);

  const selectedDateString = mounted ? selectedDate.toLocaleDateString('en-CA') : '';
  const filteredLogs = useMemo(() => {
    return (weekLogs as LogEntry[]).filter((log) => log.local_date === selectedDateString);
  }, [weekLogs, selectedDateString]);

  const filteredMacros = useMemo(() => {
    return filteredLogs.reduce((acc, log) => {
      const s = extractLogStats(log);
      return {
        calories: acc.calories + s.calories,
        protein: acc.protein + s.protein,
        carbs: acc.carbs + s.carbs,
        fats: acc.fats + s.fat,
        fiber: acc.fiber + s.fiber,
        sugar: acc.sugar + s.sugar,
        sodium: acc.sodium + s.sodium,
        cholesterol: acc.cholesterol + s.cholesterol,
        vitamins: aggregateNutrients(acc.vitamins || {}, s.vitamins),
        minerals: aggregateNutrients(acc.minerals || {}, s.minerals),
      };
    }, { 
      calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, sugar: 0, sodium: 0, cholesterol: 0,
      vitamins: {} as Record<string, any>, minerals: {} as Record<string, any>
    });
  }, [filteredLogs]);

  // -- Insights State --
  interface InsightStats {
    protein_avg: number; carbs_avg: number; fats_avg: number;
    total_calories: number; log_count: number; logged_days: number;
    protein_total: number; carbs_total: number; fats_total: number;
  }
  const [timeRange, setTimeRange] = useState(7);
  const [stats, setStats] = useState<InsightStats | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState(false);
  const [insightsRetryKey, setInsightsRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadMetrics() {
      if (!user || activeTab !== 'insights') return;
      setInsightsLoading(true);
      setInsightsError(false);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - timeRange);

      try {
        const { data: logs, error } = await supabase
          .from('logs')
          .select('grams, metabolic_tags_json, local_date')
          .eq('user_id', user.id)
          .gte('local_date', startDate.toLocaleDateString('en-CA'));

        if (cancelled) return;
        if (error || !logs) {
          setInsightsError(true);
          setInsightsLoading(false);
          return;
        }

        let p = 0, c = 0, f = 0, cal = 0;
        const loggedDays = new Set<string>();
        (logs as { metabolic_tags_json: Record<string, unknown> | null; local_date: string | null }[]).forEach((log) => {
          const macros = (log.metabolic_tags_json ?? {}) as Record<string, unknown>;
          p += Number(macros.protein ?? 0);
          c += Number(macros.carbs ?? 0);
          f += Number(macros.fats ?? macros.fat ?? 0);
          cal += Number(macros.calories ?? 0);
          if (log.local_date) loggedDays.add(log.local_date);
        });

        // Average per logged day, not per calendar day — sparse logging
        // shouldn't deflate the numbers a user actually recorded
        const dayCount = Math.max(loggedDays.size, 1);
        setStats({
          protein_avg: Math.round(p / dayCount),
          carbs_avg: Math.round(c / dayCount),
          fats_avg: Math.round(f / dayCount),
          total_calories: Math.round(cal / dayCount),
          log_count: logs.length,
          logged_days: loggedDays.size,
          protein_total: Math.round(p),
          carbs_total: Math.round(c),
          fats_total: Math.round(f)
        });
        setInsightsLoading(false);
      } catch {
        if (!cancelled) {
          setInsightsError(true);
          setInsightsLoading(false);
        }
      }
    }
    loadMetrics();
    return () => { cancelled = true; };
  }, [timeRange, user, activeTab, supabase, insightsRetryKey]);

  if (loading) return (
    <div role="status" aria-label="Loading dashboard" className="min-h-screen bg-[var(--bg-app)] px-6 pt-12 pb-32">
      <div className="h-3 w-28 rounded-full shimmer mb-3" />
      <div className="h-9 w-52 rounded-xl shimmer mb-8" />
      <div className="h-12 rounded-2xl shimmer mb-8" />
      <div className="h-72 rounded-[40px] shimmer mb-6" />
      <div className="grid grid-cols-3 gap-3">
        <div className="h-24 rounded-2xl shimmer" />
        <div className="h-24 rounded-2xl shimmer" />
        <div className="h-24 rounded-2xl shimmer" />
      </div>
      <span className="sr-only">Loading your dashboard</span>
    </div>
  );

  const meta = user?.metabolic_state_json || {};
  const calorieGoal = user?.calorie_target || 2000;
  const proteinTarget = meta.protein_target || 140;
  const carbsTarget = meta.carbs_target || 180;
  const fatsTarget = meta.fats_target || 65;

  // Honest gauge status, derived from actual progress against the goal
  const energyPct = calorieGoal > 0 ? dailyMacros.calories / calorieGoal : 0;
  const energyStatus = energyPct > 1.1
    ? { label: 'Over budget', tone: 'text-[var(--error-text)]' }
    : energyPct >= 0.9
      ? { label: 'On target', tone: 'text-[var(--success-text)]' }
      : { label: 'In budget', tone: 'text-[var(--primary-text)]' };
  const todayString = new Date().toLocaleDateString('en-CA');
  const filteredLogsToday = (dailyLogs as LogEntry[]).filter((log) => log.local_date === todayString).length;

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] pb-32 font-sans overflow-x-hidden transition-colors">
      
      <header className="px-6 pt-12 pb-4 bg-[var(--bg-app)]/80 backdrop-blur-xl sticky top-0 z-40 border-b border-[var(--border)]">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] shadow-[0_0_10px_var(--primary)] animate-pulse-subtle" aria-hidden="true" />
              <span className="hud-label text-[var(--primary-text)]">Live console</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight">
              Oteka <span className="text-[var(--primary-text)]">Command</span>
            </h1>
            <div className="flex items-center gap-3 mt-4">
               <div className="flex items-center gap-1.5 text-[var(--primary-text)] font-bold bg-[var(--bg-surface)] px-3 py-1.5 rounded-xl shadow-sm border border-[var(--primary)]/10">
                 <Flame size={14} fill="currentColor" />
                 <span className="text-[11px] tabular-nums">{user?.streak_count || 0}-day streak</span>
               </div>
               {isProUser && (
                  <div className="flex items-center gap-1.5 text-[var(--primary-text)] font-bold bg-[var(--primary)]/10 px-3 py-1.5 rounded-xl shadow-sm border border-[var(--primary)]/20">
                    <Crown size={12} fill="currentColor" />
                    <span className="text-[11px]">Solar active</span>
                  </div>
               )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
                aria-label="Open settings"
                onClick={() => router.push('/settings')}
                className="w-12 h-12 bg-[var(--bg-surface)] rounded-2xl flex items-center justify-center shadow-xl shadow-[var(--primary)]/10 border border-[var(--primary)]/5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-200 active:scale-95"
            >
                <Settings size={22} />
            </button>
            <button
                aria-label="Open profile"
                onClick={() => router.push('/profile')}
                className="w-12 h-12 bg-[var(--bg-surface)] rounded-2xl flex items-center justify-center shadow-xl shadow-[var(--primary)]/10 border border-[var(--primary)]/5 overflow-hidden transition-transform duration-200 active:scale-95"
            >
                {user?.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" /> : <User size={22} className="text-[var(--primary-text)]" />}
            </button>
          </div>
        </div>

        {/* Unified Tab Bar */}
        <div role="tablist" aria-label="Dashboard sections" onKeyDown={handleTabKeyDown} className="flex bg-[var(--bg-surface)] p-1 rounded-2xl border border-[var(--border)] relative">
          {TABS.map((tab) => (
            <button
              key={tab}
              id={`dashboard-tab-${tab}`}
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`dashboard-panel-${tab}`}
              tabIndex={activeTab === tab ? 0 : -1}
              onClick={() => selectTab(tab)}
              className={`flex-1 relative py-3 text-xs font-bold capitalize z-10 transition-colors ${activeTab === tab ? 'text-[var(--primary-fg)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            >
              {activeTab === tab && (
                <motion.div
                  layoutId="active-dashboard-tab"
                  className="absolute inset-0 bg-[var(--primary)] rounded-xl -z-10 shadow-md shadow-[var(--primary)]/20"
                  transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              {tab}
            </button>
          ))}
        </div>
      </header>

      <main className="px-6 mt-6 pb-20">
        <AnimatePresence mode="wait">
          
          {/* HUB TAB */}
          {activeTab === 'hub' && (
            <motion.div key="hub" role="tabpanel" id="dashboard-panel-hub" aria-labelledby="dashboard-tab-hub" variants={container} initial="hidden" animate="show" exit={{ opacity: 0, y: reduceMotion ? 0 : -10 }} className="space-y-6">
              
              {/* Calibration Banner */}
              {(() => {
                const latestUnratedLog = dailyLogs.find(l => {
                  const tags = l.metabolic_tags_json as any;
                  return !tags?.user_score && !tags?.feedback;
                });
                if (!latestUnratedLog) return null;
                const mealTime = new Date(latestUnratedLog.captured_at).getTime();
                const diffMins = Math.floor((Date.now() - mealTime) / 60000);
                const mealName = latestUnratedLog.metabolic_tags_json?.food_name || latestUnratedLog.metabolic_tags_json?.item || 'Latest Meal';
                if (diffMins >= 0 && diffMins < 30) {
                  return (
                    <motion.div variants={item} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[28px] p-4 flex items-center justify-between shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 left-0 h-1 bg-[var(--primary)]/30 w-full">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${(diffMins / 30) * 100}%` }} transition={reduceMotion ? { duration: 0 } : undefined} className="h-full bg-[var(--primary)]" />
                      </div>
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/5 flex items-center justify-center text-[var(--primary)] animate-pulse shrink-0">
                          <Clock size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[var(--text-primary)] truncate">Digesting {mealName}</p>
                          <p className="text-[11px] text-[var(--text-secondary)] font-medium mt-0.5 tabular-nums">Energy calibration window opens in {30 - diffMins}m</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                }
                if (diffMins >= 30 && diffMins <= 180) {
                  return (
                    <motion.button type="button" variants={item} whileHover={reduceMotion ? undefined : { scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={() => router.push('/rating')} className="w-full text-left bg-gradient-to-r from-[var(--primary)]/20 to-[var(--primary)]/5 border border-[var(--primary)]/30 rounded-[32px] p-5 shadow-lg shadow-[var(--primary)]/5 relative overflow-hidden group">
                      <div className="absolute -top-12 -right-12 w-32 h-32 bg-[var(--primary)]/10 rounded-full blur-2xl group-hover:bg-[var(--primary)]/25 transition-all" />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div className="w-12 h-12 rounded-2xl bg-[var(--primary)] text-[var(--primary-fg)] flex items-center justify-center shadow-md shadow-[var(--primary)]/20 shrink-0">
                            <Zap size={22} fill="currentColor" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[11px] font-semibold text-[var(--primary-text)]">Calibration window open</span>
                            <p className="text-sm font-bold text-[var(--text-primary)] mt-1 truncate">Calibrate {mealName}</p>
                            <p className="text-[11px] text-[var(--text-secondary)] font-medium mt-0.5 tabular-nums">{diffMins}m elapsed • How is your energy & digestion?</p>
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-[var(--primary)] group-hover:translate-x-1 transition-transform shrink-0" />
                      </div>
                    </motion.button>
                  );
                }
                return null;
              })()}

              <motion.div variants={item} className="bg-[var(--bg-surface)] rounded-[32px] p-6 shadow-sm border border-[var(--border)] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5"><Sparkles size={80} strokeWidth={1} /></div>
                <div className="flex items-center gap-2 mb-3 relative z-10">
                  <div className="w-6 h-6 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary-text)]"><Sparkles size={14} /></div>
                  <span className="text-[13px] font-semibold text-[var(--text-secondary)]">Metabolic advisor</span>
                </div>
                <p className="text-sm leading-relaxed text-[var(--text-primary)] relative z-10 font-medium italic">"{adviceError ? 'The advisor is unavailable right now.' : (advice || 'Analyzing your metabolic alignment...')}"</p>
              </motion.div>

              {logsError ? (
              <motion.div variants={item} role="alert" className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[40px] p-8 text-center">
                <WifiOff size={28} className="mx-auto mb-3 text-[var(--text-secondary)]" />
                <h2 className="text-sm font-bold text-[var(--text-primary)]">Couldn&apos;t load today&apos;s data</h2>
                <p className="text-xs text-[var(--text-secondary)] font-medium mt-1">Check your connection and try again.</p>
                <button
                  onClick={() => refetchLogs()}
                  className="mt-4 inline-flex items-center gap-2 h-10 px-4 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl text-[11px] font-bold text-[var(--text-primary)] active:scale-95 transition-transform"
                >
                  <RefreshCw size={12} /> Try again
                </button>
              </motion.div>
              ) : (
              <motion.div variants={item} className="bg-[var(--bg-surface)] rounded-[40px] p-8 shadow-sm border border-[var(--border)] relative overflow-hidden flex flex-col items-center">
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-[var(--primary)]/5 rounded-full blur-3xl" />
                <div className="absolute -top-20 -right-20 w-56 h-56 bg-[var(--accent)]/5 rounded-full blur-3xl" />
                <h2 className="text-[13px] font-semibold text-[var(--text-secondary)] mb-8">Daily energy</h2>
                <div className="relative w-56 h-56 flex items-center justify-center">
                   <svg className="w-full h-full transform -rotate-90" viewBox="0 0 224 224" role="img" aria-label={`${dailyMacros.calories.toFixed(0)} of ${calorieGoal} calories consumed`}>
                      <defs>
                        <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="var(--primary)" />
                          <stop offset="100%" stopColor="var(--accent)" />
                        </linearGradient>
                      </defs>
                      {/* Instrument tick track */}
                      <circle cx="112" cy="112" r="100" stroke="var(--border)" strokeWidth="2" strokeDasharray="2 10" fill="transparent" opacity="0.9" />
                      {/* Recessed track */}
                      <circle cx="112" cy="112" r="100" stroke="currentColor" strokeWidth="14" fill="transparent" className="text-[var(--bg-app)]" />
                      {/* Progress arc */}
                      <motion.circle
                        initial={{ strokeDasharray: "0 628" }}
                        animate={{ strokeDasharray: `${Math.min((dailyMacros.calories / calorieGoal) * 628, 628)} 628` }}
                        transition={reduceMotion ? { duration: 0 } : { duration: 1.2, ease: "easeOut", delay: 0.1 }}
                        cx="112" cy="112" r="100"
                        stroke="url(#scoreGradient)"
                        strokeWidth="14"
                        strokeLinecap="round"
                        fill="transparent"
                        style={{ filter: 'drop-shadow(0 0 10px rgba(var(--ring), 0.45))' }}
                      />
                   </svg>
                   <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-mono text-5xl font-bold tracking-tight text-[var(--text-primary)] tabular-nums">{dailyMacros.calories.toFixed(0)}</span>
                      <span className="text-[11px] font-semibold text-[var(--text-secondary)] mt-1 tabular-nums">of {calorieGoal.toLocaleString()} kcal</span>
                      <span className={`text-[11px] font-bold mt-2 ${energyStatus.tone}`}>{energyStatus.label}</span>
                   </div>
                </div>
                <div className="mt-8 grid grid-cols-2 gap-3 w-full">
                   <div className="text-center bg-[var(--bg-app)]/60 border border-[var(--border)] rounded-3xl py-4">
                      <p className="font-mono text-2xl font-bold text-[var(--text-primary)] tabular-nums">{Math.max(0, calorieGoal - dailyMacros.calories).toFixed(0)}</p>
                      <p className="text-[11px] font-medium text-[var(--text-secondary)] mt-1">Remaining</p>
                   </div>
                   <div className="text-center bg-[var(--bg-app)]/60 border border-[var(--border)] rounded-3xl py-4">
                      <p className="font-mono text-2xl font-bold text-[var(--primary-text)] tabular-nums">{filteredLogsToday}</p>
                      <p className="text-[11px] font-medium text-[var(--text-secondary)] mt-1">Meals logged</p>
                   </div>
                </div>
              </motion.div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <motion.div variants={item}>
                  <button onClick={() => router.push('/vision')} className="flex flex-col items-center gap-2 group w-full">
                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }} className="w-16 h-16 rounded-[24px] flex items-center justify-center shadow-sm group-hover:shadow-xl transition-all border bg-[var(--primary)]/10 text-[var(--primary-text)] border-[var(--primary)]/20">
                      <Camera size={24} strokeWidth={2.5} />
                    </motion.div>
                    <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Scan</span>
                  </button>
                </motion.div>
                <motion.div variants={item}>
                  <PricingGuard plan={user?.plan} featureName="Planner">
                    <button onClick={() => router.push('/pantry')} className="flex flex-col items-center gap-2 group w-full">
                      <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }} className="w-16 h-16 rounded-[24px] border flex items-center justify-center shadow-sm group-hover:shadow-xl transition-all bg-[var(--primary)]/10 text-[var(--primary-text)] border-[var(--primary)]/20">
                        <Target size={24} strokeWidth={2.5} />
                      </motion.div>
                      <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Plan</span>
                    </button>
                  </PricingGuard>
                </motion.div>
                <motion.div variants={item}>
                  <PricingGuard plan={user?.plan} featureName="Shopping Logistics">
                    <button onClick={() => router.push('/shopping')} className="flex flex-col items-center gap-2 group w-full">
                      <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }} className="w-16 h-16 rounded-[24px] border flex items-center justify-center shadow-sm group-hover:shadow-xl transition-all bg-[var(--primary)]/10 text-[var(--primary-text)] border-[var(--primary)]/20">
                        <ShoppingCartIcon size={24} strokeWidth={2.5} />
                      </motion.div>
                      <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Shop</span>
                    </button>
                  </PricingGuard>
                </motion.div>
              </div>

              {!logsError && (
              <motion.div variants={item} className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Protein', value: dailyMacros.protein, target: proteinTarget, icon: Zap },
                    { label: 'Carbs', value: dailyMacros.carbs, target: carbsTarget, icon: Flame },
                    { label: 'Fats', value: dailyMacros.fat, target: fatsTarget, icon: Droplets },
                  ].map((macro) => (
                    <div key={macro.label} className="bg-[var(--bg-surface)] p-4 rounded-2xl border border-[var(--border)] shadow-sm">
                      <div className="flex items-center gap-1.5 mb-2 text-[var(--text-secondary)]">
                        <macro.icon size={12} />
                        <span className="text-[11px] font-semibold">{macro.label}</span>
                      </div>
                      <div className="flex items-baseline gap-0.5 font-mono tabular-nums">
                        <span className="text-lg font-bold text-[var(--text-primary)]">{macro.value.toFixed(0)}</span>
                        <span className="text-[10px] font-bold text-[var(--text-secondary)]">/{macro.target}</span>
                      </div>
                      <div className="mt-3 h-1 bg-[var(--bg-app)] rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((macro.value / macro.target) * 100, 100)}%` }} transition={reduceMotion ? { duration: 0 } : undefined} className="h-full bg-[var(--primary)] rounded-full" />
                      </div>
                    </div>
                  ))}
              </motion.div>
              )}
            </motion.div>
          )}

          {/* LOGS TAB */}
          {activeTab === 'logs' && (
            <motion.div key="logs" role="tabpanel" id="dashboard-panel-logs" aria-labelledby="dashboard-tab-logs" variants={container} initial="hidden" animate="show" exit={{ opacity: 0, y: reduceMotion ? 0 : -10 }} className="space-y-6">
              
              {/* Week pager */}
              <motion.div variants={item} className="flex items-center justify-between gap-3">
                <button
                  onClick={() => pageWeek(-1)}
                  aria-label={atFreeBoundary ? 'Previous week — Oteka Solar required beyond last week' : 'Previous week'}
                  className="relative w-11 h-11 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:scale-95 transition-all shrink-0"
                >
                  <ChevronLeft size={18} />
                  {atFreeBoundary && (
                    <span aria-hidden="true" className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] flex items-center justify-center shadow-sm">
                      <Lock size={7} strokeWidth={3.5} />
                    </span>
                  )}
                </button>
                <div className="flex items-center gap-2 min-w-0">
                  <span aria-live="polite" className="font-mono text-xs font-bold tabular-nums text-[var(--text-primary)] truncate">{weekRangeLabel(weekStart)}</span>
                  {!isCurrentWeek && (
                    <button
                      onClick={goToday}
                      className="text-[11px] font-bold text-[var(--primary-text)] bg-[var(--primary)]/10 border border-[var(--primary)]/20 rounded-full px-2.5 py-1 active:scale-95 transition-transform shrink-0"
                    >
                      Today
                    </button>
                  )}
                </div>
                <button
                  onClick={() => pageWeek(1)}
                  disabled={isCurrentWeek}
                  aria-label="Next week"
                  className="w-11 h-11 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none shrink-0"
                >
                  <ChevronRight size={18} />
                </button>
              </motion.div>

              <motion.div variants={item} className="overflow-x-auto scrollbar-hide -mx-6 px-6">
                <div className="flex justify-between min-w-full gap-3">
                  {weekDates.map((d, i) => {
                    const isActive = d.dateString === selectedDateString;
                    return (
                        <motion.button
                          key={i} whileTap={{ scale: 0.96 }} onClick={() => { if (!guardEditing()) setSelectedDate(d.fullDate); }}
                          aria-pressed={isActive}
                          className={`flex flex-col items-center justify-center min-w-[54px] py-4 rounded-2xl transition-colors duration-200 ${isActive ? 'bg-[var(--primary)] text-[var(--primary-fg)] shadow-lg shadow-[var(--primary)]/30' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border)] shadow-sm hover:text-[var(--text-primary)]'}`}
                        >
                          <span className="text-[11px] font-semibold mb-1">{d.day}</span>
                          <span className="text-base font-black font-mono tabular-nums">{d.date}</span>
                        </motion.button>
                    );
                  })}
                </div>
              </motion.div>

              {weekError ? (
                <motion.div variants={item} role="alert" className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[32px] p-8 text-center">
                  <WifiOff size={28} className="mx-auto mb-3 text-[var(--text-secondary)]" />
                  <h2 className="text-sm font-bold text-[var(--text-primary)]">Couldn&apos;t load this week</h2>
                  <p className="text-xs text-[var(--text-secondary)] font-medium mt-1">Check your connection and try again.</p>
                  <button
                    onClick={() => refetchWeek()}
                    className="mt-4 inline-flex items-center gap-2 h-10 px-4 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl text-[11px] font-bold text-[var(--text-primary)] active:scale-95 transition-transform"
                  >
                    <RefreshCw size={12} /> Try again
                  </button>
                </motion.div>
              ) : weekLoading ? (
                <div role="status" aria-label="Loading week" className="space-y-6">
                  <div className="h-28 rounded-[32px] shimmer border border-[var(--border)]" />
                  <div className="space-y-4 pt-4">
                    <div className="h-[120px] rounded-3xl shimmer border border-[var(--border)]" />
                    <div className="h-[120px] rounded-3xl shimmer border border-[var(--border)]" />
                  </div>
                  <span className="sr-only">Loading this week&apos;s logs</span>
                </div>
              ) : (
              <>
              <motion.div variants={item} className="bg-[var(--bg-surface)] rounded-[32px] p-6 shadow-sm border border-[var(--border)] flex flex-col items-center">
                 {/* Aggregated Daily Micros Subbar */}
                 <div className="flex justify-between items-center w-full gap-2">
                    {[
                        { label: 'Fiber', val: filteredMacros.fiber, unit: 'g', name: 'Fiber' },
                        { label: 'Sugar', val: filteredMacros.sugar, unit: 'g', name: 'Sugar' },
                        { label: 'Sodium', val: filteredMacros.sodium, unit: 'mg', name: 'Sodium' },
                        { label: 'Chol.', val: filteredMacros.cholesterol, unit: 'mg', name: 'Cholesterol' },
                    ].map(m => (
                        <button key={m.label} aria-label={`About ${m.name}`} className="text-center flex-1 rounded-lg py-1 active:scale-95 transition-transform" onClick={() => setSelectedNutrient(m.name)}>
                          <div className="text-[11px] font-medium text-[var(--text-secondary)] mb-0.5 underline decoration-dotted decoration-[var(--text-secondary)]/60 underline-offset-2">{m.label}</div>
                          <div className="text-xs font-bold text-[var(--text-primary)] font-mono tabular-nums">{Math.round(m.val)}<span className="text-[10px] text-[var(--text-secondary)] ml-0.5">{m.unit}</span></div>
                        </button>
                    ))}
                  </div>

                  {Object.keys(filteredMacros.vitamins || {}).length > 0 && (
                    <div className="w-full mt-6 pt-4 border-t border-[var(--border)]">
                      <h2 className="text-[13px] font-semibold text-[var(--text-secondary)] mb-3">Micronutrients</h2>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {Object.entries(filteredMacros.vitamins).slice(0, 4).map(([name, data]: [string, any]) => (
                          <button key={name} aria-label={`About ${name}`} className="flex justify-between items-center w-full rounded-md active:scale-[0.98] transition-transform" onClick={() => setSelectedNutrient(name)}>
                            <span className="text-[11px] font-medium text-[var(--text-primary)] truncate max-w-[80px]">{name}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-12 h-1 bg-[var(--bg-app)] rounded-full overflow-hidden">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(data.daily_value_pct, 100)}%` }} transition={reduceMotion ? { duration: 0 } : undefined} className={`h-full ${data.daily_value_pct >= 100 ? 'bg-[var(--success)]' : 'bg-[var(--primary)]'}`} />
                              </div>
                              <span className="text-[10px] font-bold tabular-nums w-7 text-right font-mono text-[var(--text-primary)]">{Math.round(data.daily_value_pct)}%</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
              </motion.div>

              <motion.div variants={item} className="space-y-4 pt-4">
                <h2 className="text-[13px] font-semibold text-[var(--text-secondary)] px-2">Meal feed</h2>
                <AnimatePresence mode="popLayout">
                    {filteredLogs.length === 0 ? (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 bg-[var(--bg-surface)] rounded-[24px] border border-dashed border-[var(--border)]">
                        <Utensils size={32} className="mx-auto text-[var(--text-secondary)] opacity-20 mb-3" />
                        <p className="text-sm text-[var(--text-secondary)] font-medium">No meals logged for this day</p>
                        {selectedDateString === todayString ? (
                          <button
                            onClick={() => router.push('/vision')}
                            className="mt-4 inline-flex items-center gap-2 h-11 px-5 bg-[var(--primary)] text-[var(--primary-fg)] rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-[var(--primary)]/20 active:scale-95 transition-transform"
                          >
                            <Camera size={14} /> Scan a meal
                          </button>
                        ) : (
                          <button
                            onClick={() => router.push('/history')}
                            className="mt-4 inline-flex items-center h-10 px-4 text-[11px] font-bold text-[var(--primary-text)] active:scale-95 transition-transform"
                          >
                            View full history →
                          </button>
                        )}
                    </motion.div>
                    ) : (
                    filteredLogs.map((log: LogEntry) => (
                        <LogEntryCard key={log.id} log={log} />
                    ))
                    )}
                </AnimatePresence>
              </motion.div>

              <div className="text-center">
                <button
                  onClick={() => router.push('/history')}
                  className="py-2 px-3 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  View full history →
                </button>
              </div>
              </>
              )}

              <NutrientInfoModal nutrientName={selectedNutrient || ''} isOpen={!!selectedNutrient} onClose={() => setSelectedNutrient(null)} />
              <ProUpgradeDialog isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
              
              <motion.button
                onClick={() => router.push('/vision')}
                aria-label="Log a meal"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                className="fixed bottom-24 right-6 w-16 h-16 bg-[var(--primary)] text-[var(--primary-fg)] rounded-2xl shadow-2xl shadow-[var(--primary)]/40 flex items-center justify-center z-50"
              >
                <Plus size={36} strokeWidth={3} />
              </motion.button>
            </motion.div>
          )}

          {/* INSIGHTS TAB */}
          {activeTab === 'insights' && (
            <motion.div key="insights" role="tabpanel" id="dashboard-panel-insights" aria-labelledby="dashboard-tab-insights" variants={container} initial="hidden" animate="show" exit={{ opacity: 0, y: reduceMotion ? 0 : -10 }} className="space-y-6">
              
              <motion.div variants={item} className="flex justify-between items-center mb-2">
                <div>
                  <h2 className="text-[13px] font-semibold text-[var(--text-secondary)] mb-1">Metabolic trends</h2>
                  <p className="text-sm text-[var(--text-secondary)] font-medium tabular-nums">Trajectory over {timeRange} days.</p>
                </div>
                <div className="flex gap-1 bg-[var(--bg-surface)] p-1 rounded-xl shadow-sm border border-[var(--border)]">
                  {[7, 14, 30].map(days => (
                    <button
                      key={days}
                      onClick={() => setTimeRange(days)}
                      aria-pressed={timeRange === days}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold font-mono tabular-nums transition-all ${timeRange === days ? 'bg-[var(--primary)] text-[var(--primary-fg)] shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                      {days}d
                    </button>
                  ))}
                </div>
              </motion.div>

              {insightsError ? (
                <motion.div variants={item} role="alert" className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[32px] p-8 text-center">
                  <WifiOff size={28} className="mx-auto mb-3 text-[var(--text-secondary)]" />
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Couldn&apos;t load trends</h3>
                  <p className="text-xs text-[var(--text-secondary)] font-medium mt-1">Check your connection and try again.</p>
                  <button
                    onClick={() => setInsightsRetryKey(k => k + 1)}
                    className="mt-4 inline-flex items-center gap-2 h-10 px-4 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl text-[11px] font-bold text-[var(--text-primary)] active:scale-95 transition-transform"
                  >
                    <RefreshCw size={12} /> Try again
                  </button>
                </motion.div>
              ) : insightsLoading ? (
                 <div role="status" aria-label="Loading trends" className="space-y-6">
                   <div className="grid grid-cols-2 gap-4">
                     <div className="h-32 rounded-[32px] shimmer border border-[var(--border)]" />
                     <div className="h-32 rounded-[32px] shimmer border border-[var(--border)]" />
                   </div>
                   <div className="h-64 rounded-[40px] shimmer border border-[var(--border)]" />
                   <span className="sr-only">Loading your trends</span>
                 </div>
              ) : (
                <>
                  {stats && stats.log_count > 0 && (
                  <motion.div variants={item} className="grid grid-cols-2 gap-4">
                    <div className="bg-[var(--bg-surface)] p-6 rounded-[32px] border border-[var(--border)] shadow-sm">
                      <div className="flex items-center gap-2 text-[var(--text-secondary)] text-[11px] font-semibold mb-3">
                        <Flame size={12} className="text-[var(--primary-text)]" />
                        <span>Daily average</span>
                      </div>
                      <div className="font-mono text-3xl font-bold tabular-nums text-[var(--text-primary)]">{stats.total_calories}</div>
                      <div className="text-[11px] font-medium text-[var(--text-secondary)] mt-1">kcal per logged day</div>
                    </div>
                    <div className="bg-[var(--bg-surface)] p-6 rounded-[32px] border border-[var(--border)] shadow-sm">
                      <div className="flex items-center gap-2 text-[var(--text-secondary)] text-[11px] font-semibold mb-3">
                        <Calendar size={12} className="text-[var(--primary-text)]" />
                        <span>Meals logged</span>
                      </div>
                      <div className="font-mono text-3xl font-bold tabular-nums text-[var(--text-primary)]">{stats.log_count}</div>
                      <div className="text-[11px] font-medium text-[var(--text-secondary)] mt-1">in this period</div>
                    </div>
                  </motion.div>
                  )}

                  <motion.div variants={item} className="bg-[var(--bg-surface)] rounded-[40px] p-8 shadow-sm border border-[var(--border)] relative overflow-hidden">
                    <div className="flex items-center justify-between mb-8 relative z-10">
                      <h3 className="text-[13px] font-semibold text-[var(--text-secondary)]">Macro balance</h3>
                      <span className="text-[11px] font-medium text-[var(--primary-text)]">per logged day</span>
                    </div>
                    
                    {stats && stats.log_count > 0 ? (
                      <div className="space-y-6 relative z-10">
                        {[
                          { label: 'Protein', current: stats.protein_avg, target: proteinTarget, icon: Zap },
                          { label: 'Carbs', current: stats.carbs_avg, target: carbsTarget, icon: Flame },
                          { label: 'Fats', current: stats.fats_avg, target: fatsTarget, icon: Droplets },
                        ].map(m => (
                          <div key={m.label}>
                            <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center gap-2">
                                <m.icon size={12} className="text-[var(--primary-text)]" />
                                <span className="text-xs font-semibold text-[var(--text-primary)]">{m.label}</span>
                              </div>
                              <span className="text-[11px] font-bold text-[var(--text-primary)] font-mono tabular-nums">{m.current}g <span className="text-[var(--text-secondary)]">/ {m.target}g</span></span>
                            </div>
                            <div className="h-2 bg-[var(--bg-app)] rounded-full overflow-hidden border border-[var(--border)]">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((m.current / m.target) * 100, 100)}%` }} transition={reduceMotion ? { duration: 0 } : { duration: 1, ease: "easeOut" }} className="h-full bg-[var(--primary)] rounded-full" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-[var(--text-secondary)]">
                        <Target className="h-12 w-12 mx-auto mb-4 opacity-10" />
                        <p className="text-xs font-medium tabular-nums">No meals logged in the last {timeRange} days</p>
                      </div>
                    )}
                  </motion.div>

                  {stats && stats.log_count > 0 && (
                    <motion.div variants={item} className="bg-[var(--secondary)] rounded-[40px] p-8 text-white relative overflow-hidden shadow-2xl">
                      <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-[var(--primary)]/20 rounded-full blur-3xl" />
                      <h3 className="text-[13px] font-semibold text-[var(--primary)] mb-6 tabular-nums">Total intake · {timeRange} days</h3>
                      <div className="grid grid-cols-3 gap-4 relative z-10">
                        <div className="text-center">
                          <div className="font-mono text-xl font-bold tabular-nums">{stats.protein_total}g</div>
                          <div className="text-[11px] font-medium text-white/70 mt-1">Protein</div>
                        </div>
                        <div className="text-center">
                          <div className="font-mono text-xl font-bold tabular-nums">{stats.carbs_total}g</div>
                          <div className="text-[11px] font-medium text-white/70 mt-1">Carbs</div>
                        </div>
                        <div className="text-center">
                          <div className="font-mono text-xl font-bold tabular-nums">{stats.fats_total}g</div>
                          <div className="text-[11px] font-medium text-white/70 mt-1">Fats</div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  );
}
