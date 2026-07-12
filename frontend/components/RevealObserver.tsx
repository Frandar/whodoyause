'use client';

import { useEffect } from 'react';

/**
 * Scroll-reveal from the design reference (home-decoded.html): elements marked
 * `data-reveal` fade and rise into place when they enter the viewport, staggered
 * by `data-reveal-delay` (ms). Render once on any page that uses the markers.
 * The hidden/visible states live in globals.css; reduced-motion reveals
 * everything immediately.
 */
export function RevealObserver() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (els.length === 0) return;

    const reveal = (el: HTMLElement) => {
      el.style.transitionDelay = `${el.dataset.revealDelay ?? 0}ms`;
      el.classList.add('is-revealed');
      // Clear the delay once the entrance finishes so hover transitions stay snappy.
      window.setTimeout(() => {
        el.style.transitionDelay = '0ms';
      }, 700 + Number(el.dataset.revealDelay ?? 0));
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach(reveal);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal(entry.target as HTMLElement);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
    );
    els.forEach((el) => io.observe(el));

    // Safety net from the reference: never leave content permanently hidden.
    const failsafe = window.setTimeout(() => {
      els.forEach((el) => {
        reveal(el);
        io.unobserve(el);
      });
    }, 2600);

    return () => {
      window.clearTimeout(failsafe);
      io.disconnect();
    };
  }, []);

  return null;
}
