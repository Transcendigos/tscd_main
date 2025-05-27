/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,html}", // Scans these files for Tailwind classes
  ],
  theme: {
    extend: {
      colors: {
        seLightRed: '#f8aab6',
        seLightGreen: '#8be076',
        altSlate: '#1e293b'        
      },
    },
  },
  plugins: [],
}