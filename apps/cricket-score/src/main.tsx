import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrandProvider, ThemeProvider } from "@rajesh-hub/ui"
import { configureStorage } from "@rajesh-hub/offline-store"
import App from "./App"
import { setupDeepLinks } from "./deep-link"
import "./index.css"

// Every on-device file for this app lives under this folder name.
configureStorage({ root: "cricket-score" })
setupDeepLinks()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="system">
      <BrandProvider value={{ companyName: "Cricket Score", companyLogo: null }}>
        <App />
      </BrandProvider>
    </ThemeProvider>
  </StrictMode>,
)
