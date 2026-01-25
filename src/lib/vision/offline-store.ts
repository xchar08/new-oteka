import { enqueueMutation } from '@/lib/offline/queue';

export async function storeOfflineVisionData(userId: string, inferenceResult: any, imageBase64: string) {
  
  // 1. Create a "Store & Forward" payload
  const payload = {
    inference_data: inferenceResult, // From Node A
    raw_image: imageBase64, // Stored to allow server re-validation later if wifi permits
    captured_at: new Date().toISOString()
  };

  // 2. Enqueue
  await enqueueMutation({
    id: crypto.randomUUID(),
    type: 'VISION_LOG',
    user_id: userId,
    payload: payload,
    client_updated_at_ms: Date.now()
  });

  return { stored: true, queue_id: payload.captured_at };
}
