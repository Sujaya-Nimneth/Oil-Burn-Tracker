import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const eslintConfig = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'public/**',
      'scripts/**/*.json',
      'src/**/*.json'
    ]
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Matches the levels the project previously declared in .eslintrc.json
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      // Reading localStorage/sessionStorage or matchMedia must happen in an
      // effect for SSR/hydration safety — the canonical init-with-setState
      // pattern trips this rule, so keep it advisory.
      'react-hooks/set-state-in-effect': 'warn'
    }
  },
  {
    files: ['scripts/**/*.js'],
    rules: {
      // CLI data scripts log by design and are CommonJS
      'no-console': 'off',
      '@typescript-eslint/no-require-imports': 'off'
    }
  },
  {
    files: ['functions/**/*.ts'],
    rules: {
      // Server-side request/error logging is expected in Pages Functions
      'no-console': 'off'
    }
  },
  {
    // Vendored shadcn/ui components kept close to upstream (e.g. the sidebar
    // skeleton intentionally uses Math.random inside useMemo)
    files: ['src/components/ui/**'],
    rules: {
      'react-hooks/purity': 'warn'
    }
  }
];

export default eslintConfig;
