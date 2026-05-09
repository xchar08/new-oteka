'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Mail, Lock, Sparkles, UserPlus, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/state/appStore'

function ThemeWrapper({ children }: { children: React.ReactNode }) {
    const { colorTheme } = useAppStore();
    return <div className={`theme-${colorTheme} contents`}>{children}</div>;
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const supabase = createClient()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (mode === 'signup') {
      if (password.length < 6) {
        alert('Password must be at least 6 characters.')
        setLoading(false)
        return
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: 'com.oteka.app://login'
        }
      })
      if (error) {
        alert(error.message)
      } else {
        alert('Account created! Please check your email for the confirmation link, or sign in now if auto-login is enabled.')
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          window.location.href = '/dashboard';
        } else {
          setMode('login');
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        alert(error.message)
      } else {
        window.location.href = '/dashboard';
      }
    }
    setLoading(false)
  }

  const handleGoogleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'com.oteka.app://login',
        skipBrowserRedirect: true
      }
    })
    
    if (error) {
      alert(error.message)
      return
    }

    if (data?.url) {
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url: data.url })
    }
  }

  return (
    <ThemeWrapper>
        <div className="relative min-h-screen flex items-center justify-center p-6 bg-[var(--bg-app)] overflow-hidden font-sans">
          {/* Solar Energy Background Elements */}
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] bg-[var(--primary)]/20 rounded-full blur-[120px] pointer-events-none" 
          />
          <motion.div 
            animate={{ 
              scale: [1.2, 1, 1.2],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-[-20%] right-[-10%] w-[80%] h-[80%] bg-[var(--accent)]/15 rounded-full blur-[120px] pointer-events-none" 
          />
          
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="w-full max-w-md z-10"
          >
            <div className="text-center mb-10">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="inline-flex items-center justify-center w-20 h-20 rounded-[24px] bg-[var(--primary)]/10 text-[var(--primary)] mb-6 shadow-2xl shadow-[var(--primary)]/20 border border-[var(--primary)]/20"
                >
                  <Sparkles size={40} strokeWidth={2.5} />
                </motion.div>
                <h1 className="text-6xl font-black tracking-tighter text-[var(--text-primary)] mb-2 uppercase">
                  Oteka
                </h1>
                <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-[var(--primary)] opacity-80">
                  Metabolic Optimization Engine
                </p>
            </div>

            <Card className="border-white/10 bg-white/5 backdrop-blur-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] rounded-[40px] overflow-hidden border">
              <CardHeader className="space-y-1 pb-4 pt-10 text-center">
                  <CardTitle className="text-xl font-bold text-[var(--text-primary)]">
                    {mode === 'login' ? 'System Access' : 'Initialize Account'}
                  </CardTitle>
                  <CardDescription className="text-[var(--text-secondary)] text-sm font-medium">
                    {mode === 'login' ? 'Resume your metabolic evolution.' : 'Start your journey to vitality.'}
                  </CardDescription>
              </CardHeader>

              <CardContent className="px-8 pb-10 pt-4">
                <div className="space-y-6">
                  
                  {/* Google Login */}
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full flex items-center justify-center gap-3 font-bold h-14 bg-white/5 border-white/10 text-[var(--text-primary)] rounded-[24px] hover:bg-white/10 transition-all shadow-sm active:scale-95"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continue with Google
                  </Button>

                  <div className="flex items-center gap-4">
                      <div className="h-px flex-1 bg-white/10" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-40">OR</span>
                      <div className="h-px flex-1 bg-white/10" />
                  </div>

                  <form onSubmit={handleAuth} className="space-y-4">
                    <div className="space-y-3">
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-secondary)] opacity-50 group-focus-within:text-[var(--primary)] group-focus-within:opacity-100 transition-all" />
                        <Input 
                          type="email" 
                          placeholder="Email address" 
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          required
                          className="h-14 pl-12 bg-white/5 border-white/10 focus:border-[var(--primary)]/50 focus:ring-1 focus:ring-[var(--primary)]/20 text-[var(--text-primary)] rounded-[20px] font-medium transition-all"
                        />
                      </div>

                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-secondary)] opacity-50 group-focus-within:text-[var(--primary)] group-focus-within:opacity-100 transition-all" />
                        <Input 
                          type="password" 
                          placeholder="Password"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          required
                          className="h-14 pl-12 bg-white/5 border-white/10 focus:border-[var(--primary)]/50 focus:ring-1 focus:ring-[var(--primary)]/20 text-[var(--text-primary)] rounded-[20px] font-medium transition-all"
                        />
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full font-black text-sm uppercase tracking-widest h-14 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white rounded-[24px] shadow-xl shadow-[var(--primary)]/20 transition-all flex items-center justify-center gap-2 mt-2 active:scale-95 group" 
                      disabled={loading}
                    >
                      {loading ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : mode === 'login' ? (
                        <>Sign In <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
                      ) : (
                        <>Create Account <UserPlus size={18} /></>
                      )}
                    </Button>
                  </form>

                  <div className="pt-4 text-center">
                    <button 
                      type="button"
                      className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--primary)] transition-all"
                      onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                      disabled={loading}
                    >
                      {mode === 'login' 
                        ? "New to Oteka? Register" 
                        : "Existing User? Access"}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="mt-8 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-30"
            >
              Secure Neural Authentication v8.0.1
            </motion.p>
          </motion.div>
        </div>
    </ThemeWrapper>
  )
}
