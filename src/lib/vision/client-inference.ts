import * as ort from 'onnxruntime-web';

/**
 * Node A: Edge Intelligence (Full Phase 2 Implementation)
 * ARCHITECTURE: 
 * 1. Vision Encoder -> Embeddings
 * 2. Mask Decoder -> Segmentation (Shape)
 * 3. Depth Estimator -> Volumetric Data (Size)
 */

// Model Paths (Requires 6 files total in public/models/)
const ENCODER_PATH = '/models/encoder.onnx';
const DECODER_PATH = '/models/decoder.onnx';
const DEPTH_PATH = '/models/depth_small_quant.onnx'; // NEW: Depth Anything V2 or MiDaS Small

let encoderSession: ort.InferenceSession | null = null;
let decoderSession: ort.InferenceSession | null = null;
let depthSession: ort.InferenceSession | null = null;

// Helper: Standard Image Normalization
function preprocessImage(image: HTMLImageElement, width: number, height: number): Float32Array {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Canvas context failed");
  ctx.drawImage(image, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height).data;

  const float32Data = new Float32Array(1 * 3 * width * height);
  const channelStride = width * height;

  for (let i = 0; i < channelStride; i++) {
    const r = imageData[i * 4] / 255.0;
    const g = imageData[i * 4 + 1] / 255.0;
    const b = imageData[i * 4 + 2] / 255.0;

    // Standard ImageNet Mean/Std
    float32Data[i] = (r - 0.485) / 0.229;
    float32Data[i + channelStride] = (g - 0.456) / 0.224;
    float32Data[i + channelStride * 2] = (b - 0.406) / 0.225;
  }
  return float32Data;
}

async function initModels() {
  if (encoderSession && decoderSession && depthSession) return;

  try {
    const options: ort.InferenceSession.SessionOptions = {
      executionProviders: ['webgpu', 'wasm'], 
      graphOptimizationLevel: 'all'
    };

    // Load all 3 models in parallel
    [encoderSession, decoderSession, depthSession] = await Promise.all([
      ort.InferenceSession.create(ENCODER_PATH, options),
      ort.InferenceSession.create(DECODER_PATH, options),
      ort.InferenceSession.create(DEPTH_PATH, options)
    ]);
    
  } catch (e) {
    console.error("Failed to load ONNX models", e);
    throw new Error("Model loading failed. Ensure all .onnx files are in public/models/");
  }
}

export async function runClientInference(imageElement: HTMLImageElement) {
  await initModels();
  if (!encoderSession || !decoderSession || !depthSession) throw new Error("Models not initialized");

  const SAM_DIM = 1024;
  const DEPTH_DIM = 518; // Common size for Depth Anything / MiDaS

  // --- STEP 1: SEGMENTATION (SAM 3) ---
  // Preprocess for SAM
  const samInput = preprocessImage(imageElement, SAM_DIM, SAM_DIM);
  const samTensor = new ort.Tensor('float32', samInput, [1, 3, SAM_DIM, SAM_DIM]);
  
  // Run Encoder
  const encResults = await encoderSession.run({ pixel_values: samTensor });
  const embeddings = encResults.image_embeddings;

  // Run Decoder (Center Click Simulation)
  const pointCoords = new Float32Array([512, 512, 0, 0]); 
  const pointLabels = new Float32Array([1, -1]); 
  
  const decResults = await decoderSession.run({
    image_embeddings: embeddings,
    point_coords: new ort.Tensor('float32', pointCoords, [1, 2, 2]),
    point_labels: new ort.Tensor('float32', pointLabels, [1, 2]),
    mask_input: new ort.Tensor('float32', new Float32Array(1 * 1 * 256 * 256), [1, 1, 256, 256]),
    has_mask_input: new ort.Tensor('float32', new Float32Array([0]), [1])
  });

  // --- STEP 2: DEPTH ESTIMATION (Volumetric) ---
  // Preprocess for Depth Model
  const depthInput = preprocessImage(imageElement, DEPTH_DIM, DEPTH_DIM);
  const depthTensor = new ort.Tensor('float32', depthInput, [1, 3, DEPTH_DIM, DEPTH_DIM]);
  
  const depthResults = await depthSession.run({ input: depthTensor }); // Check input name 'input' or 'pixel_values'
  const depthMap = depthResults.depth || depthResults.predicted_depth || Object.values(depthResults)[0];

  return {
    model_version: "sam3_split_depth_v1",
    timestamp: Date.now(),
    segmentation: {
      shape: decResults.masks.dims,
      // In production: Run RLE compression here
      preview_rle: "compressed_data_placeholder"
    },
    volumetric: {
      depth_map_shape: depthMap.dims,
      // Store statistical summary of depth for volume calc
      mean_depth: calculateMean(depthMap.data as Float32Array),
      max_depth: calculateMax(depthMap.data as Float32Array)
    }
  };
}

// Simple stats helpers
function calculateMean(data: Float32Array) {
  let sum = 0;
  for(let i=0; i<data.length; i++) sum += data[i];
  return sum / data.length;
}

function calculateMax(data: Float32Array) {
  let max = -Infinity;
  for(let i=0; i<data.length; i++) if(data[i] > max) max = data[i];
  return max;
}
