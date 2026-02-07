import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") ?? "";

serve(async (req) => {
  // CORS Headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-user-token",
  };

  // Handle Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Auth Check (Gateway Bypass Strategy)
    const authHeader = req.headers.get("Authorization");
    const customAuth = req.headers.get("x-user-token");

    let token = "";
    let authMethod = "none";

    if (customAuth) {
      token = customAuth;
      authMethod = "custom_header";
    } else if (authHeader) {
      token = authHeader.replace("Bearer ", "");
      authMethod = "standard_bearer";
    }

    if (!token) {
      return new Response("Missing Authorization (Header or x-user-token)", {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Service role key for server-side (bypasses RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: `Bearer ${token}` } }, // Forward user token? No, context is easier with getUser
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );

    // Explicitly verify the token
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error("Auth User Search Failed:", error);
      return new Response(
        JSON.stringify({
          error: `Unauthorized: ${error?.message || "User not found"}`,
          debug_auth: {
            has_user: !!user,
            error_details: error,
            diag: {
              auth_method: authMethod,
              received_token_len: token.length,
              token_preview: token.slice(-5),
              // Extract 'wnfnyhmq...' from https://wnfnyhmq...supabase.co
              project_ref:
                (Deno.env.get("SUPABASE_URL") ?? "").split("://")[1]?.split(
                  ".",
                )[0] || "unknown",
              has_env_anon: !!Deno.env.get("SUPABASE_ANON_KEY"),
              lib_version: "2.39.3",
            },
          },
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 2. Parse Body
    const { image, mode } = await req.json();
    if (!image) {
      return new Response("No image provided", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 3. Fetch User Profile for Calibration
    const { data: profile } = await supabase
      .from("users")
      .select("hand_width_mm, metabolic_state_json")
      .eq("id", user.id)
      .single();

    const userHandMm = profile?.hand_width_mm || 85; // Default 85mm
    const userGoal = profile?.metabolic_state_json?.current_goal ||
      "maintenance";

    // 4. Node B: Identification (Gemini 2.0 Flash)
    // We use Gemini to "See" the image and extract tags/text.
    const descriptionPrompt = `Analyze this food image. 
       1. List all visible food items.
       2. Describe the container/portion size relative to the hand (if visible).
       3. Transcribe any visible nutrition labels or text.
       4. Return a concise, factual scene description. Do not estimate calories yet.`;

    const descriptionPayload = {
      contents: [{
        parts: [
          { text: descriptionPrompt },
          { inline_data: { mime_type: "image/jpeg", data: image } },
        ],
      }],
    };

    // Call Gemini (Vision)
    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`;
    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(descriptionPayload),
    });

    if (!geminiResponse.ok) {
      throw new Error(`Gemini Vision Failed: ${await geminiResponse.text()}`);
    }

    const geminiData = await geminiResponse.json();
    const sceneDescription =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No description generated.";

    // 5. Node C: Physics Core (DeepSeek R1 via Nebius/OpenAI Interface)
    // We use DeepSeek's reasoning to calculate physics/math.
    // Note: Using OpenAI-compatible endpoint for DeepSeek if NEBIUS_API_KEY is present,
    // otherwise falling back to Gemini for the physics step (Graceful Degradation).

    const NEBIUS_API_KEY = Deno.env.get("NEBIUS_API_KEY") || "";
    const DEEPSEEK_BASE_URL =
      "https://api.studio.nebius.ai/v1/chat/completions"; // Check your specific endpoint

    let finalResult;

    if (NEBIUS_API_KEY) {
      // DeepSeek R1 Pipeline
      const physicsPrompt = `
          You are a Physics Core for a metabolic tracker.
          
          Input Data:
          - Scene Description: "${sceneDescription}"
          - Reference Hand Width: ${userHandMm}mm
          - User Goal: ${userGoal}
          
          Task:
          1. Estimate the volume of the food in cubic centimeters (cm³).
          2. Suggest a density for the food based on its type (e.g., Rice=1.3g/cm³).
          3. Calculate the mass in grams via Density * Volume.
          4. Calculate total calories, macros (protein, carbs, fat), and MICROS (vitamins/minerals).
          5. Break down the food into "Molecular Scaffolding" (base ingredients).
          
          Return ONLY JSON in this format:
          { 
            "items": ["string"], 
            "ingredients": [{"name": "string", "ratio": 0.0}], 
            "macros": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }, 
            "micros": [{"name": "string", "amount": "string", "daily_value_pct": 0}], 
            "volume_cm3": 0, 
            "bounding_box": [0,0,0,0],
            "reasoning_trace": "Brief explanation of the calculation"
          }
        `;

      const deepSeekPayload = {
        model: "deepseek-ai/DeepSeek-R1", // Validate exact model name
        messages: [
          {
            role: "system",
            content:
              "You are a precise nutritional physics engine. Output JSON only.",
          },
          { role: "user", content: physicsPrompt },
        ],
        temperature: 0.1,
      };

      const deepSeekResponse = await fetch(DEEPSEEK_BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${NEBIUS_API_KEY}`,
        },
        body: JSON.stringify(deepSeekPayload),
      });

      if (deepSeekResponse.ok) {
        const dsData = await deepSeekResponse.json();
        const rawContent = dsData.choices?.[0]?.message?.content || "{}";
        // Clean markdown
        const jsonStr = rawContent.replace(/```json/g, "").replace(/```/g, "")
          .trim();
        finalResult = JSON.parse(jsonStr);
      } else {
        console.warn(
          "DeepSeek Failed, falling back to Gemini Logic:",
          await deepSeekResponse.text(),
        );
        // Fallback to Gemini Logic if DeepSeek fails
      }
    }

    // Fallback: If DeepSeek failed or Key missing, ask Gemini to do the math too
    if (!finalResult) {
      const fallbackPrompt =
        `Identify food in this image. Hand Width: ${userHandMm}mm.
            Estimate Volume (cm3), Mass (g), Calories, Macros, Micros, and Ingredients.
            Return ONLY JSON: { "items": ["name"], "ingredients": [{"name": "string", "ratio": 0.0}], "macros": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }, "micros": [{"name": "string", "amount": "string", "daily_value_pct": 0}], "volume_cm3": 0, "bounding_box": [0,0,0,0] }`;

      const fbPayload = {
        contents: [{
          parts: [
            { text: fallbackPrompt },
            { inline_data: { mime_type: "image/jpeg", data: image } },
          ],
        }],
      };

      const fbRes = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fbPayload),
      });

      const fbData = await fbRes.json();
      const rawText = fbData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const jsonStr = rawText.replace(/```json/g, "").replace(/```/g, "")
        .trim();
      finalResult = JSON.parse(jsonStr);
    }

    // 6. Return Result
    return new Response(
      JSON.stringify(finalResult),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Pipeline Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
