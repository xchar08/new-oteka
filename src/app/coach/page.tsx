'use client';

import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/state/appStore';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { Send, Bot, Sparkles, Loader2, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/layout/BottomNav';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
};

export default function CoachPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const isOnline = useAppStore(s => s.isOnline);
  const router = useRouter();

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (messages.length === 0) {
      setTimeout(() => {
        setMessages([{
          role: 'assistant',
          content: "Hello! I'm your Metabolic Coach. I can help you optimize your nutrition, track patterns, and achieve your health goals. How are you feeling today?",
          ts: Date.now()
        }]);
      }, 600);
    }
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || busy) return;

    const userMsg: Message = { role: 'user', content: input, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setBusy(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        'advisor-context',
        {
          body: { context: 'chat', query: userMsg.content },
        }
      );

      if (error) throw new Error(error.message || 'Advisor unreachable');

      const aiMsg: Message = {
        role: 'assistant',
        content: data.advice || "I'm analyzing your metrics...",
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Connection error. Please check your internet and try again.',
          ts: Date.now(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const quickPrompts = [
    "What's my protein target today?",
    "Suggest a high energy meal",
    "How's my metabolic score?",
    "Best foods for brain focus?"
  ];

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col text-[var(--text-primary)] transition-colors duration-500">
      {/* Header */}
      <header className="px-6 pt-safe pb-4 bg-[var(--bg-app)]/80 backdrop-blur-md sticky top-0 z-40 border-b border-[var(--border)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
                onClick={() => router.back()}
                className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
            >
                <ChevronLeft size={24} />
            </button>
            <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
              <Bot size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight">Metabolic Coach</h1>
              <p className="text-[10px] text-[var(--primary)] font-bold uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
                {isOnline ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center text-[var(--primary)]">
            <Sparkles size={18} />
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6" ref={scrollRef}>
        <AnimatePresence>
          {messages.map((m) => (
            <motion.div
              key={m.ts}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] p-4 rounded-[24px] text-sm leading-relaxed shadow-sm ${
                  m.role === 'user'
                    ? 'bg-[var(--primary)] text-white rounded-br-sm font-medium'
                    : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border)] rounded-tl-sm'
                }`}
              >
                {m.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {busy && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] text-sm px-5 py-4 rounded-[24px] rounded-tl-sm flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] opacity-40 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] opacity-60 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] opacity-100 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Quick Prompts */}
      {messages.length <= 2 && (
        <div className="px-6 pb-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickPrompt(prompt)}
                className="flex-shrink-0 px-5 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-full text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 bg-[var(--bg-surface)]/80 backdrop-blur-xl border-t border-[var(--border)] pb-32">
        <form
          className="flex gap-3 items-center max-w-lg mx-auto"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
        >
          <input
            className="flex-1 bg-[var(--bg-app)] border border-[var(--border)] rounded-[24px] px-6 py-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/40 focus:border-[var(--primary)] outline-none transition-all shadow-inner"
            placeholder="Coach..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="h-14 w-14 rounded-[24px] bg-[var(--primary)] text-white shadow-lg flex items-center justify-center transition-all active:scale-90 disabled:opacity-30"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send size={20} />}
          </button>
        </form>
      </div>

      <BottomNav />
    </div>
  );
}
