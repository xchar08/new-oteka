'use client';

import { useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Crown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useModalA11y } from '@/lib/hooks/useModalA11y';

interface ProUpgradeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  body?: string;
}

/**
 * Quiet-premium upgrade prompt: opened only by explicit user action against
 * a gated boundary, states the value plainly, one CTA, easy dismissal.
 */
export function ProUpgradeDialog({
  isOpen,
  onClose,
  title = 'Browse your full history',
  body = 'Free accounts can look back one week. Oteka Solar keeps your entire metabolic record one tap away.',
}: ProUpgradeDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  useModalA11y(isOpen, onClose, dialogRef);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
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
            aria-labelledby="pro-upgrade-title"
            className="fixed inset-x-6 top-[28%] max-w-sm mx-auto bg-[var(--bg-surface)] border border-[var(--primary)]/30 rounded-[32px] z-[101] shadow-[0_0_50px_rgba(var(--ring),0.15)] p-7 focus:outline-none"
          >
            <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex items-center justify-center text-[var(--primary-text)]">
              <Crown size={22} fill="currentColor" />
            </div>
            <h2 id="pro-upgrade-title" className="text-xl font-bold text-[var(--text-primary)] mt-4">
              {title}
            </h2>
            <p className="text-sm text-[var(--text-secondary)] font-medium leading-relaxed mt-2">
              {body}
            </p>
            <div className="mt-6 space-y-2">
              <button
                onClick={() => { onClose(); router.push('/pricing'); }}
                className="w-full h-12 bg-[var(--primary)] text-[var(--primary-fg)] rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-[var(--primary)]/20 active:scale-95 transition-transform"
              >
                Upgrade to Solar
              </button>
              <button
                onClick={onClose}
                className="w-full h-11 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Not now
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
