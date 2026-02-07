'use client';

import { motion } from 'framer-motion';

export const ScanningGrid = () => {
  return (
    <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
      {/* Moving Scan Line */}
      <motion.div
        initial={{ top: '-10%' }}
        animate={{ top: '110%' }}
        transition={{ 
          duration: 2, 
          repeat: Infinity, 
          ease: "linear",
          repeatDelay: 0.5
        }}
        className="absolute left-0 right-0 h-32 bg-gradient-to-b from-transparent via-emerald-500/20 to-transparent z-30"
      />
      
      {/* Horizontal Laser Line */}
      <motion.div
        initial={{ top: '-10%' }}
        animate={{ top: '110%' }}
        transition={{ 
            duration: 2, 
            repeat: Infinity, 
            ease: "linear",
            repeatDelay: 0.5
        }}
        className="absolute left-0 right-0 h-[2px] bg-emerald-400/50 shadow-[0_0_15px_rgba(52,211,153,0.8)] z-40"
      />

      {/* Grid Overlay */}
      <div 
        className="absolute inset-0 z-10 opacity-20"
        style={{
            backgroundImage: `linear-gradient(#10b981 1px, transparent 1px), linear-gradient(90deg, #10b981 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            maskImage: 'radial-gradient(circle at center, black 40%, transparent 80%)'
        }}
      />
      
      {/* Data Points (Randomized particle effect could go here, but keeping it performant for now) */}
      <div className="absolute inset-0 flex items-center justify-center">
         <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1.1, opacity: 1 }}
            transition={{ duration: 1, repeat: Infinity, repeatType: "reverse" }}
            className="w-64 h-64 border border-emerald-500/30 rounded-full animate-pulse"
         />
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.5 }}
            transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse", delay: 0.2 }}
            className="absolute w-48 h-48 border border-emerald-500/20 rounded-full"
         />
      </div>
    </div>
  );
};
