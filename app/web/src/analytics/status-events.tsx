import { ReactNode, useEffect } from 'react';

export interface StatusTransitionDetail {
  state: 'healthy' | 'degraded' | 'offline';
  checkedAt: number;
}

function logStatusTransition(detail: StatusTransitionDetail) {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const timestamp = new Date(detail.checkedAt).toISOString();
  console.info('[shell-status]', detail.state, timestamp);
}

export function StatusAnalyticsProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<StatusTransitionDetail | undefined>;
      if (!customEvent.detail) {
        return;
      }
      logStatusTransition(customEvent.detail);
    };

    window.addEventListener('shell:status-transition', handler as EventListener);

    return () => {
      window.removeEventListener('shell:status-transition', handler as EventListener);
    };
  }, []);

  return <>{children}</>;
}
