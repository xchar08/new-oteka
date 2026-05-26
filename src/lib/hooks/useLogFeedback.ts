import { useState } from 'react';
import { visionService } from '@/lib/services/vision.service';
import type { LogMetadata } from '@/lib/types/metabolic';

export function useLogFeedback(logId: string | undefined, initialMeta: LogMetadata & { feedback?: any }) {
  const [feedback, setFeedback] = useState(initialMeta.feedback || { taste: 3, satiety: 3, digestion: 3 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasFeedback, setHasFeedback] = useState(!!initialMeta.feedback);

  const submitFeedback = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!logId) return;
    
    setIsSubmitting(true);
    try {
      await visionService.updateLogFeedback(logId, initialMeta, feedback);
      setHasFeedback(true);
    } catch (e) {
      console.error("Failed to calibrate algorithm", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    feedback,
    setFeedback,
    isSubmitting,
    hasFeedback,
    submitFeedback
  };
}
