/**
 * Configuration for the Oteka Neural Vision Pipeline.
 */
export const VISION_CONFIG = {
  modes: {
    ANALYZE: 'analyze',
    BARCODE: 'barcode',
    MENU: 'menu'
  },
  fallbacks: {
    HAND_WIDTH_MM: 85
  },
  image: {
    MAX_DIMENSION: 1024,
    QUALITY: 0.8
  }
};
