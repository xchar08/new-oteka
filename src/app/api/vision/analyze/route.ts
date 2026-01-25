import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runVisionPipeline } from '@/lib/workflows/vision';
import { logWorkflowEvent } from '@/lib/audit/logger';
import { checkMedicalContraindications } from '@/lib/engine/medical/rules';
// Note: If you haven't fixed the redis install yet, comment this import out temporarily
import { checkRateLimit } from '@/lib/redis'; 

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // --- 1. Rate Limit Check (New) ---
    // Protects your expensive Vision/LLM APIs
    const { success } = await checkRateLimit(user.id);
    if (!success) {
      await logWorkflowEvent(user.id, 'vision_log', 'failed', { error: 'rate_limit_exceeded' });
      return NextResponse.json(
        { error: 'Too many requests. Please wait 10 seconds.' },
        { status: 429 }
      );
    }

    // --- 2. Handle FormData ---
    const formData = await req.formData();
    const file = formData.get('file') as Blob;

    if (!file) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    // --- 3. Run Pipeline ---
    // Returns: { raw_identification, physics_output, safety_analysis, meta }
    const result = await runVisionPipeline(user.id, base64);

    // --- 4. Medical Safety Check ---
    const macros = result.physics_output?.macros || {}; 
    const mainFoodName = result.raw_identification?.items?.[0] || 'Unknown Food';

    const medicalCheck = await checkMedicalContraindications(user.id, macros);

    const isMedicallySafe = medicalCheck.safe;
    const allWarnings = [
      ...(result.safety_analysis?.warnings || []), 
      ...medicalCheck.warnings
    ];

    // --- 5. Audit Log ---
    await logWorkflowEvent(user.id, 'vision_log', 'success', {
      food: mainFoodName,
      macros: macros,
      safety_warnings: allWarnings,
      safe: isMedicallySafe
    });

    // --- 6. Return Response ---
    return NextResponse.json({
      ...result,
      safety_analysis: {
        safe: isMedicallySafe && (result.safety_analysis?.safe ?? true),
        warnings: allWarnings
      },
      summary: {
        name: mainFoodName,
        calories: macros.calories || 0
      }
    });

  } catch (err: any) {
    console.error("Vision Analysis Failed:", err);
    
    // Ensure we log errors too
    await logWorkflowEvent(user.id, 'vision_log', 'failed', { error: err.message });

    if (err.message === 'CALIBRATION_REQUIRED') {
      return NextResponse.json({ error: 'Calibration Required', code: 'CALIB_REQ' }, { status: 428 });
    }
    
    return NextResponse.json({ error: err.message || 'Analysis failed' }, { status: 500 });
  }
}
