/**
 * WebGPU / Thermal Throttling Guard
 * Prevents running heavy local ONNX models on low-end devices or when battery is critical.
 */

// 1. Extend the Navigator interface locally so TS knows about 'gpu'
interface NavigatorWithGPU extends Navigator {
  gpu?: {
    requestAdapter: () => Promise<GPUAdapter | null>;
  };
  getBattery?: () => Promise<{
    charging: boolean;
    level: number;
    saveMode?: boolean; // Non-standard heuristic
  }>;
}

interface GPUAdapter {
  limits: {
    maxComputeWorkgroupStorageSize: number;
  };
}

export async function checkHardwareCapability(): Promise<{ safe: boolean; reason?: string }> {
  const nav = navigator as NavigatorWithGPU;

  // 1. Check WebGPU Support
  if (!nav.gpu) {
    return { safe: false, reason: 'webgpu_unsupported' };
  }

  try {
    const adapter = await nav.gpu.requestAdapter();
    if (!adapter) return { safe: false, reason: 'no_adapter' };

    // 2. Check for Low-Power Mode (Battery API)
    if (nav.getBattery) {
      const battery = await nav.getBattery();
      // Heuristic: Some browsers might map saveMode, but we mainly check level/charging
      if (battery.saveMode) { 
        return { safe: false, reason: 'battery_saver' };
      }
      if (!battery.charging && battery.level < 0.2) {
        return { safe: false, reason: 'low_battery' };
      }
    }

    // 3. Thermal Throttling Heuristic
    // If the GPU has very low storage limits, it's likely a weak mobile GPU
    const limits = adapter.limits;
    if (limits.maxComputeWorkgroupStorageSize < 16384) {
      return { safe: false, reason: 'weak_gpu' };
    }

    return { safe: true };

  } catch (e) {
    console.error("Hardware Check Failed", e);
    // Fail safe -> Allow execution if check errors, or block? 
    // Usually safer to fallback to server if we can't verify hardware.
    return { safe: false, reason: 'check_error' };
  }
}
