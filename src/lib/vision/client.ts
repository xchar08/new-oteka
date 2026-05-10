import { runClientInference as runDetailedInference } from './client-inference';

/**
 * Client-Side Vision Interface
 * Provides unified access to on-device SAM 3 and Depth estimation.
 */

export async function initVisionClient() {
  console.log('Initializing Neural Vision Core...');
  // Models are initialized on first run in detailed inference
}

export async function runClientInference(imageElement: HTMLImageElement): Promise<any> {
  try {
    const result = await runDetailedInference(imageElement);
    
    return {
      source: 'client_neural_v1',
      timestamp: Date.now(),
      ...result,
      note: 'Processed via on-device SAM 3 + Depth Core'
    };
  } catch (e) {
    console.error('Client Inference Failed:', e);
    throw e;
  }
}
