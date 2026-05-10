import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', "./.storybook/**/*.{js,jsx,ts,tsx}"],
  prefix: 'rgp-',
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
