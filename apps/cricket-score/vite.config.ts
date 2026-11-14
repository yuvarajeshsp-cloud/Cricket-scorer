import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Hub packages have no tsconfig of their own, so without this esbuild compiles
  // their .tsx with the classic runtime and the page fails with "React is not defined".
  esbuild: { jsx: "automatic" },
})
