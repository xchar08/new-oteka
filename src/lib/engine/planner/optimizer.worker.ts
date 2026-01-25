// Import from the local copy we just made (TS will pick up the .d.ts automatically)
import init, { optimize_meal_plan } from './planner_wasm';

addEventListener('message', async (e) => {
  const { type, data } = e.data;

  if (type === 'START_NSGA2') {
    try {
      // 1. Initialize WASM
      // IMPORTANT: We still load the binary from the PUBLIC folder URL
      await init('/planner-wasm/planner_wasm_bg.wasm');

      // 2. Prepare Input for Rust
      // Map your JS data to the struct Rust expects
      let request = {
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

      // 3. Run Optimization (Rust)
      const result = optimize_meal_plan(request);

      // 4. Handle Result
      if (result && result.selected_foods) {
         // Transform back to your Solution type
         const solution = {
           menu: result.selected_foods.map((f: any) => f.name),
           stats: {
             calories: result.total_calories,
             protein: result.total_protein
           },
           score: result.fitness_score
         };

         postMessage({ 
           type: 'SUCCESS', 
           payload: { solutions: [solution], retries_used: 0 } 
         });
      } else {
        postMessage({ type: 'ERROR', payload: 'Optimization failed to return valid result' });
      }

    } catch (err: any) {
      console.error("WASM Optimization Failed:", err);
      postMessage({ type: 'ERROR', payload: err.message });
    }
  }
});
