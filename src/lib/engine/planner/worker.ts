// This is a Web Worker
// It should be imported using: new Worker(new URL('./worker.ts', import.meta.url))

// If strictly using Next.js, we might need to place this in public or use specific worker loader
// But for now we define the logic.

// We assume the wasm is available to be imported or loaded.
// Since we are inside 'src/lib/engine/planner', and 'planner-wasm/pkg' is at root.
// We may need to copy the pkg to public or import it dynamically.

// Placeholder for WASM import
// import init, { run_nsga2 } from '@/../planner-wasm/pkg/planner_wasm'; 

addEventListener('message', async (event) => {
  const { inputs, constraints } = event.data;
  
  try {
    // Initialize WASM
    // await init();
    
    // Run Optimization
    // const result = run_nsga2(JSON.stringify(inputs), JSON.stringify(constraints));
    
    // Mock Result for now if WASM not fully built/linked in this environment context
    // In a real scenario, valid WASM calls go here.
    
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 500)); 
    
    const mockResult = {
      solutions: [
        { 
          menu: ['Avocado', 'Smoked Salmon', 'Walnuts'], 
          stats: { calories: 450 } 
        }
      ],
      retries_used: 0
    };

    postMessage({ type: 'SUCCESS', result: mockResult });
    
  } catch (error) {
    postMessage({ type: 'ERROR', error: String(error) });
  }
});

// Helper to run this in main thread if needed
export class PlannerWorker {
  private worker: Worker | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.worker = new Worker(new URL('./worker.ts', import.meta.url));
    }
  }

  optimize(inputs: any, constraints: any) {
    if (!this.worker) return Promise.reject("Worker not initialized");
    
    return new Promise((resolve, reject) => {
      this.worker!.onmessage = (e) => {
        if (e.data.type === 'SUCCESS') resolve(e.data.result);
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
