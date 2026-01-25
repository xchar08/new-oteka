'use client';

import { useRouter } from 'next/navigation';
import { BarcodeScanner } from '@/components/vision/BarcodeScanner';
import { createClient } from '@/lib/supabase/client';

export default function ScannerPage() {
  const router = useRouter();
  const supabase = createClient();

  const handleScan = async (product: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Log the found item immediately
    const { error } = await supabase.from('logs').insert({
      user_id: user.id,
      grams: 100, // Default serving
      metabolic_tags_json: {
        food_name: product.product_name,
        calories: product.nutriments['energy-kcal_100g'],
        protein: product.nutriments.proteins_100g,
        carbs: product.nutriments.carbohydrates_100g,
        fats: product.nutriments.fat_100g,
        barcode: product.code
      }
    });

    if (!error) {
      router.push('/dashboard');
    } else {
      alert('Failed to save log');
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Barcode Entry</h1>
      <BarcodeScanner onScan={handleScan} />
      
      <div className="text-center">
        <button 
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
