// Import from the local copy we just made (TS will pick up the .d.ts automatically)
import init, { optimize_meal_plan } from './planner_wasm';

addEventListener('message', async (e) => {
  const { type, data } = e.data;

  if (type === 'START_NSGA2') {
    try {
      // 1. Initialize WASM
      const wasmUrl = new URL('/planner-wasm/planner_wasm_bg.wasm', self.location.origin).href;
      console.log('[Worker] Loading WASM from:', wasmUrl);
      await init(wasmUrl);
      console.log('[Worker] WASM initialized successfully');

      // 2. Prepare Input for Rust
      const request = {
        target_calories: data.constraints.calories_max,
        target_protein: data.constraints.protein_target,
        target_carbs: 250, // Default or derive from constraints
        target_fats: 80,   // Default or derive from constraints
        available_foods: data.pantry_items.map((pi: any) => ({
          id: String(pi.id || '0'),
          name: pi.foods?.name || 'Unknown',
          calories: Number(pi.foods?.nutritional_info?.calories || 0),
          protein: Number(pi.foods?.nutritional_info?.protein || 0),
          carbs: Number(pi.foods?.nutritional_info?.carbs || 0),
          fats: Number(pi.foods?.nutritional_info?.fats || 0),
          tags: []
        }))
      };

      console.log('[Worker] Request to Rust:', {
        target_calories: request.target_calories,
        target_protein: request.target_protein,
        foods_count: request.available_foods.length,
        sample_food: request.available_foods[0]
      });

      // 3. Run Optimization (Rust)
      console.log('[Worker] Starting optimize_meal_plan...');
      const result = optimize_meal_plan(request);
      console.log('[Worker] Raw result from Rust:', result);
      console.log('[Worker] Result type:', typeof result);
      console.log('[Worker] Result keys:', result ? Object.keys(result) : 'null');

      // 4. Handle Result
      if (!result) {
        postMessage({ type: 'ERROR', payload: 'Rust returned null/undefined' });
        return;
      }

      if (!result.selected_foods || !Array.isArray(result.selected_foods)) {
        console.error('[Worker] Missing or invalid selected_foods:', result);
        postMessage({ 
          type: 'ERROR', 
          payload: `Invalid result structure. Got: ${JSON.stringify(result).substring(0, 200)}` 
        });
        return;
      }

      // Transform back to your Solution type
      const solution = {
        menu: result.selected_foods.map((f: any) => f.name),
        stats: {
          calories: result.total_calories || 0,
          protein: result.total_protein || 0
        },
        score: result.fitness_score || 0
      };

      console.log('[Worker] Transformed solution:', solution);

      postMessage({ 
        type: 'SUCCESS', 
        payload: { solutions: [solution], retries_used: 0 } 
      });

    } catch (err: any) {
      console.error("[Worker] WASM Optimization Failed:", err);
      console.error("[Worker] Error stack:", err.stack);
      postMessage({ 
        type: 'ERROR', 
        payload: `${err.message || 'Unknown error'}\n${err.stack || ''}` 
      });
    }
  }
});
