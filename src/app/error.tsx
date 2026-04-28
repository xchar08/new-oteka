'use client'
 
import { useEffect } from 'react'
 
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("APP ERROR:", error)
  }, [error])
 
  return (
    <div className="h-screen flex flex-col items-center justify-center p-6 text-center gap-4 bg-zinc-950 text-white">
      <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <h2 className="text-xl font-bold">Something went wrong</h2>
      <div className="bg-red-500/5 border border-red-500/20 p-4 rounded-xl max-w-sm w-full overflow-hidden">
        <p className="text-red-400 text-sm font-mono break-words">{error.message || "Unknown rendering error"}</p>
        {error.stack && (
            <p className="text-zinc-600 text-[10px] mt-2 font-mono text-left max-h-32 overflow-y-auto">
                {error.stack.substring(0, 300)}...
            </p>
        )}
      </div>
      <button
        onClick={() => reset()}
        className="mt-4 px-6 py-3 bg-white text-black font-bold rounded-xl active:scale-95 transition-transform"
      >
        Try again
      </button>
      <button
        onClick={() => window.location.href = '/dashboard'}
        className="text-zinc-500 text-xs underline"
      >
        Return to Hub
      </button>
    </div>
  )
}
