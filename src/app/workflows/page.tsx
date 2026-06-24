'use client';

import { useState, useEffect } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import {
  Plus, Clock, Zap, Sparkles, ChevronLeft, Trash2,
  Utensils, Droplet, Package, Activity, X, Smartphone, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { BottomNav } from '@/components/layout/BottomNav';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

/**
 * Automation = on-device scheduled reminder "agents", delivered via Capacitor
 * local notifications. These are device-local by nature, so they persist to
 * localStorage rather than the server (there is no backend workflow runner).
 */
type Agent = {
  id: string;
  presetId: string;
  name: string;
  hour: number;
  minute: number;
  route: string;
  isActive: boolean;
  notificationId: number;
  createdAt: number;
};

type Preset = {
  id: string;
  name: string;
  body: string;
  route: string;
  defaultHour: number;
  Icon: typeof Utensils;
};

const PRESETS: Preset[] = [
  { id: 'log-meal', name: 'Meal Log Nudge', body: 'Time to log a meal and keep your metabolic streak alive.', route: '/vision', defaultHour: 8, Icon: Utensils },
  { id: 'hydration', name: 'Hydration Check', body: 'Hydrate — optimal cellular function depends on it.', route: '/dashboard', defaultHour: 14, Icon: Droplet },
  { id: 'pantry-review', name: 'Pantry Review', body: 'Review your pantry stock and verify freshness.', route: '/pantry', defaultHour: 18, Icon: Package },
  { id: 'calibration', name: 'Daily Calibration', body: 'Calibrate your metabolic baseline for the day.', route: '/rating', defaultHour: 20, Icon: Activity },
];

const STORAGE_KEY = 'oteka_agents';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } },
};

const fmtTime = (h: number, m: number) => {
  const period = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
};

const presetFor = (id: string) => PRESETS.find((p) => p.id === id) ?? PRESETS[0];

export default function WorkflowsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [mounted, setMounted] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const router = useRouter();

  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();

  // Restore saved agents.
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setAgents(JSON.parse(saved));
    } catch {
      // Corrupt/unavailable storage — start empty.
    }
  }, []);

  const persist = (next: Agent[]) => {
    setAgents(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Non-fatal.
    }
  };

  const ensurePermission = async (): Promise<boolean> => {
    if (!isNative) return true; // Web: stored only, delivery happens in the app.
    try {
      const status = await LocalNotifications.requestPermissions();
      if (status.display !== 'granted') {
        toast.error('Enable notifications to activate agents.');
        return false;
      }
      return true;
    } catch {
      toast.error('Notifications unavailable on this device.');
      return false;
    }
  };

  const scheduleAgent = async (agent: Agent) => {
    if (!isNative) return;
    await LocalNotifications.schedule({
      notifications: [{
        id: agent.notificationId,
        title: `Oteka • ${agent.name}`,
        body: presetFor(agent.presetId).body,
        schedule: { on: { hour: agent.hour, minute: agent.minute }, allowWhileIdle: true },
        extra: { route: agent.route },
      }],
    });
  };

  const cancelAgent = async (agent: Agent) => {
    if (!isNative) return;
    try {
      await LocalNotifications.cancel({ notifications: [{ id: agent.notificationId }] });
    } catch {
      // Already cancelled / not scheduled — ignore.
    }
  };

  const createAgent = async (preset: Preset, hour: number, minute: number) => {
    const granted = await ensurePermission();
    if (!granted) return;

    const agent: Agent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      presetId: preset.id,
      name: preset.name,
      hour,
      minute,
      route: preset.route,
      isActive: true,
      notificationId: Math.floor(Math.random() * 2_000_000_000) + 1,
      createdAt: Date.now(),
    };

    try {
      await scheduleAgent(agent);
    } catch {
      toast.error('Could not schedule reminder.');
      return;
    }

    persist([agent, ...agents]);
    setIsCreateOpen(false);
    toast.success(
      isNative ? `${preset.name} scheduled for ${fmtTime(hour, minute)}.`
               : `${preset.name} saved — reminders fire in the Oteka app.`
    );
  };

  const toggleActive = async (agent: Agent) => {
    if (!agent.isActive) {
      const granted = await ensurePermission();
      if (!granted) return;
      await scheduleAgent(agent);
    } else {
      await cancelAgent(agent);
    }
    persist(agents.map((a) => (a.id === agent.id ? { ...a, isActive: !a.isActive } : a)));
  };

  const deleteAgent = (agent: Agent) => {
    toast(`Remove "${agent.name}"?`, {
      action: {
        label: 'Remove',
        onClick: async () => {
          await cancelAgent(agent);
          persist(agents.filter((a) => a.id !== agent.id));
          toast.success('Agent removed.');
        },
      },
    });
  };

  const activeCount = agents.filter((a) => a.isActive).length;

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] pb-32 font-sans overflow-x-hidden transition-colors duration-500">
      {/* Top App Bar */}
      <motion.header
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="px-6 pt-8 pb-4 flex justify-between items-center bg-[var(--bg-app)]/80 backdrop-blur-md sticky top-0 z-40 border-b border-[var(--border)]"
      >
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] shadow-sm">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-2xl font-black tracking-tight">Automation</h1>
        </div>
        <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--bg-surface)] shadow-sm border border-[var(--border)]">
          <Zap size={20} className="text-[var(--primary)]" />
        </div>
      </motion.header>

      <main className="px-6 py-8 space-y-8">
        <div className="flex justify-between items-end px-1">
          <div>
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-secondary)] mb-1">Background Agents</h2>
            <p className="text-sm text-[var(--text-primary)] opacity-60 font-medium">On-device metabolic routines.</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsCreateOpen(true)}
            className="bg-[var(--secondary)] text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg"
          >
            <Plus size={14} strokeWidth={4} /> New Agent
          </motion.button>
        </div>

        {/* Web delivery notice */}
        {mounted && !isNative && (
          <div className="flex items-start gap-3 bg-[var(--bg-surface)] border border-dashed border-[var(--border)] rounded-2xl p-4 text-[var(--text-secondary)]">
            <Smartphone size={18} className="text-[var(--primary)] shrink-0 mt-0.5" />
            <p className="text-xs font-medium leading-relaxed">
              Agents are saved here, but reminders are delivered by the Oteka mobile app. Install it to receive scheduled notifications.
            </p>
          </div>
        )}

        {!mounted ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-[var(--bg-surface)] rounded-[32px] animate-pulse border border-[var(--border)]" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20 bg-[var(--bg-surface)] border border-dashed border-[var(--border)] rounded-[40px] shadow-sm"
          >
            <div className="w-20 h-20 bg-[var(--bg-app)] rounded-[28px] flex items-center justify-center mx-auto mb-6 border border-[var(--border)] shadow-inner">
              <Sparkles className="text-[var(--primary)] h-10 w-10 opacity-20" />
            </div>
            <h3 className="text-xl font-black text-[var(--text-primary)]">No active agents</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-xs mx-auto font-medium px-4 leading-relaxed">
              Schedule daily reminders to automate logging, hydration, and pantry checks.
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-6 bg-[var(--primary)] text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 shadow-lg shadow-[var(--primary)]/30"
            >
              <Plus size={14} strokeWidth={4} /> Create your first agent
            </button>
          </motion.div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid gap-4">
            {agents.map((agent) => {
              const { Icon } = presetFor(agent.presetId);
              return (
                <motion.div
                  variants={itemVariants}
                  key={agent.id}
                  layout
                  className="bg-[var(--bg-surface)] rounded-[32px] p-5 flex items-center justify-between group shadow-sm border border-[var(--border)]"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-colors shrink-0 ${agent.isActive ? 'bg-[var(--primary)]/10 border-[var(--primary)]/20 text-[var(--primary)]' : 'bg-[var(--bg-app)] border-[var(--border)] text-[var(--text-secondary)]'}`}>
                      <Icon size={24} />
                    </div>
                    <div className="min-w-0">
                      <h3 className={`font-black text-lg truncate ${agent.isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                        {agent.name}
                      </h3>
                      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60 mt-1">
                        <span className="bg-[var(--bg-app)] px-2 py-0.5 rounded-lg border border-[var(--border)] flex items-center gap-1">
                          <Clock size={10} /> {fmtTime(agent.hour, agent.minute)}
                        </span>
                        <span>Daily</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => toggleActive(agent)}
                      className={`text-[9px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl border transition-all ${
                        agent.isActive
                          ? 'bg-[var(--primary)] text-white border-transparent shadow-lg shadow-[var(--primary)]/30'
                          : 'bg-[var(--bg-app)] text-[var(--text-secondary)] border-[var(--border)]'
                      }`}
                    >
                      {agent.isActive ? 'Active' : 'Paused'}
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => deleteAgent(agent)}
                      aria-label="Remove agent"
                      className="w-10 h-10 rounded-xl bg-[var(--bg-app)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--error)] hover:border-[var(--error)]/40 transition-colors"
                    >
                      <Trash2 size={16} strokeWidth={2.5} />
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Status summary */}
        <section className="bg-[var(--secondary)] rounded-[40px] p-8 text-white relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Zap size={140} strokeWidth={1} />
          </div>
          <div className="relative z-10">
            <h3 className="text-xl font-black mb-2 italic tracking-tight text-[var(--primary)]">
              {activeCount > 0 ? `${activeCount} Agent${activeCount > 1 ? 's' : ''} Active` : 'No Active Agents'}
            </h3>
            <p className="text-sm text-white/60 mb-8 max-w-[240px] font-medium leading-relaxed">
              Agents run as scheduled local notifications on your device — no server required, and they work offline.
            </p>
            <div className="flex items-center gap-2 text-[var(--primary)] font-black uppercase tracking-[0.3em] text-[9px] bg-white/5 w-fit px-4 py-2 rounded-full border border-white/5">
              {isNative ? 'Device Scheduler Ready' : 'Mobile App Required'} <CheckCircle2 size={12} />
            </div>
          </div>
        </section>
      </main>

      {/* Create Agent Modal */}
      <AnimatePresence>
        {isCreateOpen && (
          <CreateAgentModal onClose={() => setIsCreateOpen(false)} onCreate={createAgent} />
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}

function CreateAgentModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (preset: Preset, hour: number, minute: number) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Preset>(PRESETS[0]);
  const [time, setTime] = useState(`${PRESETS[0].defaultHour.toString().padStart(2, '0')}:00`);
  const [saving, setSaving] = useState(false);

  const choosePreset = (preset: Preset) => {
    setSelected(preset);
    setTime(`${preset.defaultHour.toString().padStart(2, '0')}:00`);
  };

  const handleSubmit = async () => {
    const [h, m] = time.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return;
    setSaving(true);
    await onCreate(selected, h, m);
    setSaving(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-6"
    >
      <motion.div
        initial={{ y: 40, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 40, opacity: 0 }}
        className="w-full max-w-sm bg-[var(--bg-app)] rounded-t-[40px] sm:rounded-[40px] border border-[var(--border)] p-8 shadow-2xl space-y-6"
      >
        <div className="flex justify-between items-center">
          <h3 className="text-2xl font-black tracking-tight">New Agent</h3>
          <button onClick={onClose} className="w-10 h-10 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)]">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Routine</p>
          <div className="grid grid-cols-2 gap-3">
            {PRESETS.map((preset) => {
              const isSel = selected.id === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => choosePreset(preset)}
                  className={`p-4 rounded-3xl border text-left transition-all ${
                    isSel
                      ? 'bg-[var(--primary)]/10 border-[var(--primary)] shadow-lg shadow-[var(--primary)]/10'
                      : 'bg-[var(--bg-surface)] border-[var(--border)]'
                  }`}
                >
                  <preset.Icon size={20} className={isSel ? 'text-[var(--primary)]' : 'text-[var(--text-secondary)]'} />
                  <p className={`text-xs font-black mt-3 leading-tight ${isSel ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                    {preset.name}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Daily time</p>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl h-14 px-6 outline-none focus:border-[var(--primary)] transition-all font-black text-lg"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full h-14 bg-[var(--primary)] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-[var(--primary)]/20 active:scale-95 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
        >
          <Plus size={16} strokeWidth={3} /> {saving ? 'Scheduling…' : 'Schedule Agent'}
        </button>
      </motion.div>
    </motion.div>
  );
}
