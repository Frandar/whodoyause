'use client';

import { useEffect } from 'react';
import { capture, initAnalytics } from '@/lib/analytics';
import { initErrorReporting } from '@/lib/errors';

const FIRST_VISIT_KEY = 'wdyu_first_visit';

export function AnalyticsProvider() {
  useEffect(() => {
    initAnalytics();
    initErrorReporting();

    // return_visit: fire when this device has been here before (US retention signal).
    try {
      const prior = localStorage.getItem(FIRST_VISIT_KEY);
      if (prior) {
        capture('return_visit', {
          days_since_first: Math.floor((Date.now() - Number(prior)) / 86_400_000),
        });
      } else {
        localStorage.setItem(FIRST_VISIT_KEY, String(Date.now()));
      }
    } catch {
      // localStorage unavailable (private mode) — skip return_visit.
    }
  }, []);

  return null;
}
