import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0a0a0a',
          card: '#111111',
          hover: '#1a1a1a',
        },
        border: {
          DEFAULT: '#222222',
          light: '#333333',
        },
        accent: {
          red: '#CC0000',
          'red-hover': '#aa0000',
        },
        severity: {
          low: '#eab308',
          medium: '#f97316',
          high: '#CC0000',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
