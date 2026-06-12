import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="h-screen flex flex-col items-center justify-center space-y-6 bg-[var(--bg-app)] text-[var(--text-primary)] px-6 text-center">
      <span className="font-display text-8xl font-extrabold gradient-text">404</span>
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-bold">Signal Lost</h2>
        <p className="text-sm text-[var(--text-secondary)]">This sector of the neural grid doesn&apos;t exist.</p>
      </div>
      <Link
        href="/dashboard"
        className="h-12 px-8 inline-flex items-center justify-center rounded-2xl bg-[var(--primary)] text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-[var(--primary)]/20 active:scale-95 transition-transform"
      >
        Return to Command
      </Link>
    </div>
  )
}
