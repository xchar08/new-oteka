'use client';

import { useState } from 'react';
import { fetchProductByBarcode } from '@/lib/vision/scanner';

export function BarcodeScanner({ onScan }: { onScan: (data: any) => void }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!code) return;
    setLoading(true);
    setError('');

    try {
      // In production, call your own API proxy to hide keys/rate limits
      // const res = await fetch(`/api/foods/barcode?code=${code}`);
      // const product = await res.json();
      
      // For MVP, calling the lib directly is fine
      const product = await fetchProductByBarcode(code);
      
      if (product) {
        onScan(product);
      } else {
        setError('Product not found');
      }
    } catch (e) {
      setError('Lookup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-xl border space-y-4">
      <h3 className="font-semibold text-gray-700">Scan Barcode</h3>
      
      {/* Placeholder Camera View */}
      <div className="aspect-video bg-black rounded-lg flex items-center justify-center relative overflow-hidden">
        <div className="w-full h-0.5 bg-red-500 absolute top-1/2 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
        <p className="text-gray-400 text-xs">Camera Feed Placeholder</p>
      </div>

      <div className="flex gap-2">
        <input 
          type="text" 
          placeholder="Enter UPC manually..." 
          className="flex-1 border rounded px-3 py-2 text-sm"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button 
          onClick={handleSearch}
          disabled={loading || !code}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
        >
          {loading ? '...' : 'Go'}
        </button>
      </div>

      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  );
}
