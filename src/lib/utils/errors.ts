export type ErrorCode = 
  | 'ERR_NETWORK'
  | 'ERR_VISION_FAILED'
  | 'ERR_UNAUTHORIZED'
  | 'ERR_VALIDATION'
  | 'ERR_TIMEOUT'
  | 'ERR_UNKNOWN';

/**
 * Base error class for all Oteka application errors.
 * Separates internal developer messages from user-friendly UI messages.
 */
export class OtekaError extends Error {
  public code: ErrorCode;
  public userMessage: string;

  constructor(code: ErrorCode, message: string, userMessage?: string) {
    super(message);
    this.name = 'OtekaError';
    this.code = code;
    // Default to the developer message if no specific UI message is provided
    this.userMessage = userMessage || message;
  }
}

/**
 * Normalizes any caught exception into a structured OtekaError.
 */
export function normalizeError(error: unknown): OtekaError {
  if (error instanceof OtekaError) {
    return error;
  }
  
  const msg = error instanceof Error ? error.message : String(error);
  
  // Network/Connection mappings
  if (msg.includes('Failed to fetch') || msg.includes('Network Error') || msg.includes('offline')) {
    return new OtekaError('ERR_NETWORK', msg, 'Please check your internet connection and try again.');
  }
  
  // Auth mappings
  if (msg.includes('Auth') || msg.includes('JWT') || msg.includes('unauthorized')) {
    return new OtekaError('ERR_UNAUTHORIZED', msg, 'Your session appears to have expired. Please log in again.');
  }

  // Vision mappings
  if (msg.includes('vision') || msg.includes('calibration') || msg.includes('image')) {
    return new OtekaError('ERR_VISION_FAILED', msg, 'We had trouble analyzing this image. Please ensure good lighting and try again.');
  }
  
  // Timeout mappings
  if (msg.includes('timeout') || msg.includes('AbortError')) {
    return new OtekaError('ERR_TIMEOUT', msg, 'The request took too long. Our servers might be busy, please try again.');
  }
  
  return new OtekaError('ERR_UNKNOWN', msg, 'An unexpected error occurred. We are looking into it.');
}
