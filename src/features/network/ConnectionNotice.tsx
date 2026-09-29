import { useEffect } from 'react';
import { toast } from '../../stores/ui.ts';

/**
 * Registers the service worker in production and tells the visitor when the
 * connection drops or returns. Offline, the observatory keeps running on
 * what this device has already received.
 */
export function ConnectionNotice() {
  useEffect(() => {
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
        console.warn('[sw] registration failed', error);
      });
    }
    const offline = (): void => {
      toast({
        tone: 'warning',
        title: 'Signal lost',
        body: 'You are offline. The observatory will keep running on what this device has already received.',
        line: 'ha',
        ttl: 7000,
      });
    };
    const online = (): void => {
      toast({ tone: 'success', title: 'Signal restored', body: 'Back online.', line: 'o3', ttl: 4000 });
    };
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
    };
  }, []);
  return null;
}
