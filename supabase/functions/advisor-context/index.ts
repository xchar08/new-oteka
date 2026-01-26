import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const NEBIUS_API_KEY = Deno.env.get('NEBIUS_API_KEY') || '';
const NEBIUS_BASE_URL = Deno.env.get('NEBIUS_BASE_URL') || '';

serve(async (req) => {
  try {
    // 1. Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401 })
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    // 2. Context
    const url = new URL(req.url)
    const context = url.searchParams.get('context') || 'general'

    // 3. Call Nebius (DeepSeek R1)
    const aiRes = await fetch(`${NEBIUS_BASE_URL}chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NEBIUS_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-ai/DeepSeek-R1",
        messages: [
          { role: "system", content: "You are a metabolic advisor. Be concise." },
          { role: "user", content: `Give me advice for: ${context}` }
        ]
      })
    });

    const aiData = await aiRes.json();
    const advice = aiData.choices?.[0]?.message?.content || "No advice generated.";

    return new Response(JSON.stringify({ advice }), { 
      headers: { "Content-Type": "application/json" } 
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
