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
    <div className="flex flex-col h-screen bg-palenight-bg text-zinc-100">
      <div className="p-4 border-b border-white/5 bg-palenight-surface sticky top-0 z-10">
        <h1 className="text-xl font-bold text-white">Metabolic Advisor</h1>
        <p className="text-xs text-palenight-success font-medium flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-palenight-success animate-pulse" />{' '}
          Online
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-10 text-sm">
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
              max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-md
              ${
                m.role === 'user'
                  ? 'bg-palenight-accent text-white rounded-tr-none'
                  : 'bg-palenight-surface text-zinc-100 border border-white/5 rounded-tl-none'
              }
            `}
            >
              {m.content}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex justify-start">
            <div className="bg-gray-200 text-gray-500 text-xs px-3 py-2 rounded-full animate-pulse">
              Thinking...
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-palenight-surface border-t border-white/5">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
        >
          <input
            className="flex-1 bg-palenight-bg border border-white/10 rounded-full px-4 py-3 text-sm text-white focus:ring-2 ring-palenight-accent outline-none"
            placeholder="Ask anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-full w-12 h-12 flex items-center justify-center p-0 bg-palenight-accent hover:bg-palenight-accent/80"
          >
            →
          </Button>
        </form>
      </div>
    </div>
  );
}
