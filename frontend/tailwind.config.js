/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ResQ Rover brand colors - dark operational theme
        rover: {
          bg: '#0f1117',
          panel: '#1a1d27',
          border: '#2a2d3a',
          accent: '#ff6b2b',
          success: '#22c55e',
          warning: '#f59e0b',
          danger: '#ef4444',
          info: '#3b82f6',
          text: '#e2e8f0',
          muted: '#64748b',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
