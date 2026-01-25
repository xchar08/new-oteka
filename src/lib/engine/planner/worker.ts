// This file runs on the main thread and manages the Worker instance
// to prevent UI freezing during heavy optimization.

let plannerWorker: Worker | null = null;

export type OptimizationRequest = {
  constraints: {
    calories_min: number;
    calories_max: number;
    protein_target: number;
    excluded_ingredients: string[];
  };
  pantry_items: any[];
};

export function initPlannerWorker() {
  if (typeof window !== 'undefined' && !plannerWorker) {
    plannerWorker = new Worker(new URL('./optimizer.worker.ts', import.meta.url));
  }
}

export function runOptimization(data: OptimizationRequest): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!plannerWorker) initPlannerWorker();
    
    if (!plannerWorker) {
      reject(new Error("Worker init failed"));
      return;
    }

    // Set up one-time listener for the result
    const handler = (e: MessageEvent) => {
      plannerWorker?.removeEventListener('message', handler);
      const { type, payload } = e.data;
      
      if (type === 'SUCCESS') resolve(payload);
      if (type === 'ERROR') reject(new Error(payload));
      if (type === 'RELAXED_CONSTRAINTS') {
          console.warn("Planner Warning: Constraints were relaxed to find a solution.");
          resolve(payload); // Still resolve, but maybe with a flag
      }
    };

    plannerWorker.addEventListener('message', handler);
    plannerWorker.postMessage({ type: 'START_NSGA2', data });
  });
}
