import { useState, useEffect } from 'react';

export function ExpirationCountdown({ expiresAt }: { expiresAt: number | null }) {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft('Never expires');
      return;
    }

    const updateCountdown = () => {
      const now = Date.now() / 1000;
      const diff = expiresAt - now;

      if (diff <= 0) {
        setTimeLeft('Expired');
        return;
      }

      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const mins = Math.floor((diff % 3600) / 60);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${mins}m`);
      } else {
        setTimeLeft(`${mins}m`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!expiresAt) {
    return <span className="text-sm text-gray-400">♾️ {timeLeft}</span>;
  }

  const now = Date.now() / 1000;
  const diff = expiresAt - now;
  const isExpiringSoon = diff < 86400;

  return (
    <span className={`text-sm ${isExpiringSoon ? 'text-orange-400' : 'text-gray-400'}`}>
      ⏱️ {timeLeft}
    </span>
  );
}
