// This is a Web Worker
// It should be imported using: new Worker(new URL('./worker.ts', import.meta.url))

// If strictly using Next.js, we might need to place this in public or use specific worker loader
// But for now we define the logic.

// We assume the wasm is available to be imported or loaded.
// Since we are inside 'src/lib/engine/planner', and 'planner-wasm/pkg' is at root.
// We may need to copy the pkg to public or import it dynamically.

// Placeholder for WASM import
// import init, { run_nsga2 } from '@/../planner-wasm/pkg/planner_wasm';

addEventListener("message", async (event) => {
  const { pantry_items, user_profile, conditions, constraints } = event.data;

  try {
    // Simulate complex calculation delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Logic: In a real WASM implementation, 'user_profile' (weight, height, goal) would
    // define the fitness function (e.g. Higher protein for 'muscle_gain').

    // For now, we simulate this personalization:
    let targetCalories = 500; // default meal
    if (user_profile?.metabolic_state_json?.current_goal === "muscle_gain") {
      targetCalories = 700;
    } else if (
      user_profile?.metabolic_state_json?.current_goal === "fat_loss"
    ) {
      targetCalories = 400;
    }

    // Mock Result reflecting the inputs
    const solutions = [
      {
        menu: ["Quinoa Bowl", "Grilled Chicken", "Spinach"],
        stats: { calories: targetCalories },
        personalized_note: conditions?.length > 0
          ? `Adjusted for ${conditions[0].name}`
          : `Optimized for ${
            user_profile?.metabolic_state_json?.current_goal || "User"
          }`,
      },
      {
        menu: ["Salmon Fillet", "Asparagus", "Brown Rice"],
        stats: { calories: targetCalories + 50 },
        personalized_note: `High Omega-3 for inflammation control`,
      },
    ];

    postMessage({
      type: "SUCCESS",
      result: { solutions, retries_used: 0 },
    });
  } catch (error) {
    postMessage({ type: "ERROR", error: String(error) });
  }
});

// Helper to run this in main thread if needed
export class PlannerWorker {
  private worker: Worker | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.worker = new Worker(new URL("./worker.ts", import.meta.url));
    }
  }

  optimize(inputs: any, constraints: any) {
    if (!this.worker) return Promise.reject("Worker not initialized");

    return new Promise((resolve, reject) => {
      this.worker!.onmessage = (e) => {
        if (e.data.type === "SUCCESS") resolve(e.data.result);
        else reject(e.data.error);
      };
      this.worker!.onerror = (e) => reject(e);
      this.worker!.postMessage({ inputs, constraints });
    });
  }

  terminate() {
    this.worker?.terminate();
  }
}

/**
 * Convenient helper for functional usage in components
 */
export async function runOptimization(params: any) {
  const planner = new PlannerWorker();
  try {
    return await planner.optimize(params.pantry_items, params.constraints);
  } finally {
    planner.terminate();
  }
}
