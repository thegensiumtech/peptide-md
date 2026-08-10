import type { Config } from 'tailwindcss';

/**
 * Clinical Amber.
 *
 * Colours are declared once as space-separated RGB channels in globals.css so
 * Tailwind's opacity modifiers keep working (`text-ink/60`). Nothing in the app
 * hardcodes a hex value — swapping in Peptide MD's real palette is a one-file
 * change in globals.css.
 */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: token('paper'),
        'paper-deep': token('paper-deep'),
        surface: token('surface'),
        ink: token('ink'),
        'ink-soft': token('ink-soft'),
        muted: token('muted'),
        line: token('line'),
        accent: token('accent'),
        'accent-tint': token('accent-tint'),
        'brand-bright': token('brand-bright'),
        signal: token('signal'),
        'signal-tint': token('signal-tint'),
        danger: token('danger'),
        'danger-tint': token('danger-tint'),
        'chart-direct': token('chart-direct'),
        'chart-partner': token('chart-partner'),
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Fluid scale. Display sizes carry the public site; the app surfaces
        // stay on the tighter end of the scale.
        eyebrow: ['0.6875rem', { lineHeight: '1', letterSpacing: '0.16em' }],
        micro: ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.01em' }],
        base: ['1rem', { lineHeight: '1.65' }],
        lead: ['clamp(1.0625rem, 1rem + 0.3vw, 1.25rem)', { lineHeight: '1.6' }],
        h3: ['clamp(1.25rem, 1.15rem + 0.4vw, 1.5rem)', { lineHeight: '1.25' }],
        h2: ['clamp(1.75rem, 1.5rem + 1.1vw, 2.5rem)', { lineHeight: '1.15' }],
        h1: ['clamp(2.25rem, 1.8rem + 2.2vw, 3.75rem)', { lineHeight: '1.05' }],
        hero: ['clamp(2.75rem, 1.9rem + 3.6vw, 5.5rem)', { lineHeight: '0.98' }],
      },
      spacing: {
        section: 'clamp(4rem, 3rem + 5vw, 8rem)',
      },
      maxWidth: {
        prose: '68ch',
        shell: '78rem',
      },
      borderRadius: {
        // Deliberately tight. Clinical instruments are not pill-shaped.
        DEFAULT: '3px',
        md: '4px',
        lg: '6px',
      },
      boxShadow: {
        raise: '0 1px 2px rgb(18 33 31 / 0.04), 0 8px 24px -12px rgb(18 33 31 / 0.12)',
        lift: '0 2px 4px rgb(18 33 31 / 0.05), 0 20px 40px -20px rgb(18 33 31 / 0.20)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'bond-draw': {
          from: { strokeDashoffset: '100' },
          to: { strokeDashoffset: '0' },
        },
      },
      animation: {
        'rise-in': 'rise-in 600ms cubic-bezier(0.16, 1, 0.3, 1) both',
        // Short and quiet: content that has just loaded should settle, not
        // perform. Anything longer starts to feel like waiting.
        'fade-up': 'fade-up 320ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'bond-draw': 'bond-draw 1.4s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;
