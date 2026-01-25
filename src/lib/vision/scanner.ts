// OpenFoodFacts API Wrapper

const OFF_API_URL = 'https://world.openfoodfacts.org/api/v0/product';

export type ScannedProduct = {
  code: string;
  product_name: string;
  nutriments: {
    'energy-kcal_100g'?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
  };
  image_url?: string;
};

export async function fetchProductByBarcode(barcode: string): Promise<ScannedProduct | null> {
  try {
    const res = await fetch(`${OFF_API_URL}/${barcode}.json`);
    if (!res.ok) return null;
    
    const data = await res.json();
    if (data.status !== 1) return null; // 1 = Found

    return {
      code: data.code,
      product_name: data.product?.product_name || 'Unknown Product',
      nutriments: data.product?.nutriments || {},
      image_url: data.product?.image_front_small_url,
    };
  } catch (error) {
    console.error('Barcode lookup failed:', error);
    return null;
  }
}
