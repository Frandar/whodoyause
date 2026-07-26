import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

// Flat config. eslint-config-next 16 ships native flat exports, so there is no
// FlatCompat shim. It also already registers the jsx-a11y plugin, so we enable
// the rules we care about here rather than re-adding the plugin (which errors
// with "Cannot redefine plugin").
const config = [
  {
    ignores: ['.next/**', 'out/**', 'node_modules/**', 'next-env.d.ts', 'design-reference/**'],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // The a11y bar is WCAG 2.2 AA (see CLAUDE.md "Quality bar"). These map to
      // defects the review actually found, so they are errors, not warnings.
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-is-valid': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      'jsx-a11y/aria-unsupported-elements': 'error',
      'jsx-a11y/label-has-associated-control': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/role-supports-aria-props': 'error',
      // Hook dependency mistakes caused a real bug here (a stale-closure
      // refetch on the browse page), so this is not advisory.
      'react-hooks/exhaustive-deps': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // WARN, not error — deliberately, and this should be revisited.
      // Every current violation is a "sync external state into React" effect:
      // the static-export hydration gates (/browse, /recommend read
      // window.location, which cannot be known at build time), the
      // resync-from-props effects on RecommendationCard and SearchAutocomplete,
      // and the dialog reseed. They are correct as written and load-bearing —
      // the hydration gates in particular exist to fix a real mismatch bug.
      // Failing the build on them would mean either a risky refactor of seven
      // call sites or seven inline disables, so they stay visible as warnings
      // until someone can restructure them properly (useSyncExternalStore for
      // the URL reads, `key` remounts for the prop syncs).
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];

export default config;
