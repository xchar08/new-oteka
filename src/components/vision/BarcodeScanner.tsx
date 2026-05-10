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
      
      {/* Scanning Interface */}
      <div className="aspect-video bg-zinc-950 rounded-2xl flex items-center justify-center relative overflow-hidden border border-white/5 shadow-inner">
        {/* Scanner Radar Line */}
        <div className="w-full h-[1px] bg-[var(--primary)] absolute top-1/2 animate-scan shadow-[0_0_15px_var(--primary)] z-10" />
        
        {/* Corner Brackets */}
        <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-[var(--primary)] opacity-50" />
        <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-[var(--primary)] opacity-50" />
        <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-[var(--primary)] opacity-50" />
        <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-[var(--primary)] opacity-50" />

        <div className="flex flex-col items-center gap-2 opacity-20">
            <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse" />
            </div>
            <p className="text-white text-[8px] font-black uppercase tracking-[0.4em]">Awaiting Optical Lock</p>
        </div>
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
