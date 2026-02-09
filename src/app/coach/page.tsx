'use client';

import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/state/appStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';

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

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Initial Welcome
  useEffect(() => {
    if (messages.length === 0) {
      setTimeout(() => {
        setMessages([{
          role: 'assistant',
          content: "Hello! I'm your Metabolic Coach. How are you feeling today?",
          ts: Date.now()
        }]);
      }, 500);
    }
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || busy) return;

    const userMsg: Message = { role: 'user', content: input, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setBusy(true);

    try {
      // UPDATED: Use Edge Function instead of /api/advisor/context
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
          content: 'Connection error. Try again.',
          ts: Date.now(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-6 pb-32 text-zinc-100 space-y-6 animate-in fade-in duration-500">
      <div className="p-4 pt-safe border-b border-white/5 bg-zinc-900/50 backdrop-blur-xl sticky top-0 z-10 flex justify-between items-center">
        <div>
           <h1 className="text-xl font-light tracking-tight text-white">Metabolic Advisor</h1>
           <p className="text-xs text-emerald-500 font-medium flex items-center gap-1.5 mt-0.5">
             <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_var(--success)]" />{' '}
             Online
           </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="text-center text-zinc-500 mt-10 text-sm font-medium">
            Ask about your glucose trends, protein targets, or meal timing.
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.ts}
            className={`flex ${
              m.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`
              max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm backdrop-blur-sm
              ${
                m.role === 'user'
                  ? 'bg-blue-600/20 text-blue-50 border border-blue-500/20 rounded-tr-sm'
                  : 'bg-white/5 text-zinc-200 border border-white/10 rounded-tl-sm'
              }
            `}
            >
              {m.content}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-white/5 text-zinc-500 text-xs px-4 py-2 rounded-full animate-pulse flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              Gemini 3.0 Deep Reasoning...
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-zinc-900/50 backdrop-blur-xl border-t border-white/5 pb-8">
        <form
          className="flex gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
        >
          <input
            className="flex-1 bg-black/40 border border-white/10 rounded-full px-6 py-4 text-sm text-white focus:ring-1 ring-white/20 outline-none placeholder:text-zinc-600 transition-all focus:bg-black/60"
            placeholder="Ask anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-full w-14 h-auto flex items-center justify-center p-0 bg-white text-black hover:bg-zinc-200 transition-colors shadow-lg shadow-white/5"
          >
            →
          </Button>
        </form>
      </div>
    </div>
  );
}
