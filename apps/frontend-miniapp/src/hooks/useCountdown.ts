import { useState, useEffect, useRef } from 'react';

export const useCountdown = (
  targetTime: string | null,
  onComplete?: () => void
) => {
  const [countdown, setCountdown] = useState<string>('--:--');
  const [hasCompleted, setHasCompleted] = useState(false);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  // Update ref when callback changes
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!targetTime) {
      setCountdown('--:--');
      setHasCompleted(false);
      completedRef.current = false;
      return;
    }

    // Reset completion state when targetTime changes (new round)
    setHasCompleted(false);
    completedRef.current = false;

    const updateCountdown = () => {
      const now = new Date().getTime();
      const target = new Date(targetTime).getTime();
      const diff = target - now;

      if (diff > 0) {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdown(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setCountdown('00:00:00');
        
        // Trigger onComplete only once per round
        if (!completedRef.current) {
          completedRef.current = true;
          setHasCompleted(true);
          if (onCompleteRef.current) {
            onCompleteRef.current();
          }
        }
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [targetTime]);

  return { countdown, hasCompleted };
};

