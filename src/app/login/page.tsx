'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, Lock, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      alert(error.message)
      setLoading(false)
    } else {
      // Check if user needs onboarding
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('hand_width_mm, metabolic_state_json')
          .eq('id', session.user.id)
          .single();
        
        const hasProfile = profile?.metabolic_state_json?.age || profile?.metabolic_state_json?.height_cm;
        const hasCalibration = profile?.hand_width_mm;
        
        if (!hasProfile || !hasCalibration) {
          router.push('/onboarding');
          return;
        }
      }
      router.push('/dashboard')
    }
  }

  const handleSignUp = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'com.oteka.app://login'
      }
    })
    if (error) alert(error.message)
    else alert('Check your email for the confirmation link!')
    setLoading(false)
  }

  const handleMagicLink = async () => {
    if (!email) {
      alert('Please enter your email first')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: 'com.oteka.app://login'
      }
    })
    if (error) alert(error.message)
    else alert('Magic link sent! Check your email.')
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
    <div className="relative flex min-h-screen items-center justify-center p-4 bg-black overflow-hidden selection:bg-blue-500/30">
      {/* Decorative Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-md z-10"
      >
        <Card className="border-white/10 bg-zinc-950/40 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <CardHeader className="space-y-2 pb-8">
            <div className="mx-auto w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-2">
              <Sparkles className="text-white h-6 w-6" />
            </div>
            <CardTitle className="text-3xl font-bold text-center tracking-tight">Oteka</CardTitle>
            <p className="text-center text-zinc-500 text-sm font-medium tracking-wide">Metabolic Intelligence Platform</p>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-blue-500 transition-colors" />
                  <Input 
                    type="email" 
                    placeholder="Email identity" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="pl-12 bg-black/40 border-white/5 focus:border-blue-500/50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-blue-500 transition-colors" />
                  <Input 
                    type="password" 
                    placeholder="Passkey"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="pl-12 bg-black/40 border-white/5 focus:border-blue-500/50"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <Button type="submit" size="lg" className="w-full font-bold" disabled={loading}>
                  {loading ? 'Authenticating...' : 'Sign In'}
                </Button>
                
                <Button 
                  type="button" 
                  variant="outline"
                  size="default"
                  className="w-full border-white/10 text-zinc-400 hover:text-white hover:bg-white/5"
                  onClick={handleMagicLink}
                  disabled={loading}
                >
                  Send Magic Link
                </Button>

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/5" /></div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold"><span className="bg-zinc-950/40 px-3 text-zinc-500">System Gateway</span></div>
                </div>

                <Button 
                  type="button" 
                  variant="secondary" 
                  className="w-full flex items-center justify-center gap-3 font-semibold"
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

                <button 
                  type="button"
                  className="w-full text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-6 hover:text-blue-400 transition-colors"
                  onClick={handleSignUp}
                  disabled={loading}
                >
                  New Account Registration
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
