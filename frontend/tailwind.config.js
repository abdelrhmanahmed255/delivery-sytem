/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#2563EB", // Tailwind Blue-600
        secondary: "#10B981", // Tailwind Emerald-500
        adminBg: "#F3F4F6", // Gray-100
        driverBg: "#F9FAFB", // Gray-50
      }
    },
  },
  plugins: [],
}