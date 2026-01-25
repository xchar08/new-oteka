'use client';

import { Star } from 'lucide-react';

interface MealRatingProps {
  score: number;
  max?: number;
  readOnly?: boolean;
  onRate?: (score: number) => void;
  size?: number;
}

export function MealRating({ 
  score, 
  max = 5, 
  readOnly = false, 
  onRate,
  size = 24 
}: MealRatingProps) {
  return (
    <div className="flex gap-1" role="group" aria-label="Rating">
      {Array.from({ length: max }).map((_, i) => {
        const value = i + 1;
        const isActive = value <= score;
        
        return (
          <button
            key={i}
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && onRate?.(value)}
            className={`
              transition-transform duration-100 focus:outline-none 
              ${!readOnly ? 'hover:scale-110 active:scale-95' : 'cursor-default'}
              ${isActive ? 'text-yellow-400' : 'text-gray-200'}
            `}
            aria-label={`Rate ${value} stars`}
            aria-pressed={isActive}
          >
            <Star 
              size={size} 
              fill={isActive ? "currentColor" : "none"} 
              stroke="currentColor" 
              strokeWidth={isActive ? 0 : 2}
            />
          </button>
        );
      })}
    </div>
  );
}
