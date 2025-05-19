/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "../index.html",
    "../src/**/*.{js,ts,jsx,tsx,html}", // Scans these files for Tailwind classes
  ],
  theme: {
    extend: {
      colors: {
        mblue: '#235ba8',
      },
    },
  },
  plugins: [],
}