/**
 * runOptimization — Main-thread wrapper for the planner Web Worker.
 * Spawns the worker, posts the optimization request, and returns a Promise
 * that resolves with the result or rejects on error/timeout.
 */

export interface OptimizationInput {
  pantry_items: any[];
  user_profile: any;
  conditions: any[];
  constraints: any;
  global_foods?: any[];
  recent_history?: Array<{ item_name: string; days_ago: number }>;
}

export interface OptimizationResult {
  solutions: Array<{
    menu: string[];
    stats: {
      calories: number;
      protein: number;
      carbs: number;
      fats: number;
      sodium?: number;
      sugar?: number;
    };
    personalized_note?: string;
  }>;
}

const TIMEOUT_MS = 15_000; // 15s hard limit to protect battery

export function runOptimization(input: OptimizationInput): Promise<OptimizationResult> {
  return new Promise((resolve, reject) => {
    let worker: Worker | null = null;

    try {
      worker = new Worker(
        new URL('./worker.ts', import.meta.url),
        { type: 'module' }
      );
    } catch (e) {
      reject(new Error('Failed to spawn optimization worker.'));
      return;
    }

    const timer = setTimeout(() => {
      worker?.terminate();
      reject(new Error('Optimization timed out (15s). Try relaxing constraints.'));
    }, TIMEOUT_MS);

    worker.onmessage = (event) => {
      clearTimeout(timer);
      worker?.terminate();

      const { type, result, error, payload } = event.data;

      if (type === 'SUCCESS') {
        resolve(result || payload || { solutions: [] });
      } else if (type === 'ERROR') {
        reject(new Error(error || payload || 'Optimization failed.'));
      } else {
        resolve({ solutions: [] });
      }
    };

    worker.onerror = (err) => {
      clearTimeout(timer);
      worker?.terminate();
      reject(new Error(err.message || 'Worker error'));
    };

    // Post the full input; the worker's addEventListener("message") picks it up
    worker.postMessage(input);
  });
}
