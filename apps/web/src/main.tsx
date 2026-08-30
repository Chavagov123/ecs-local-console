import { ThemeProvider } from "next-themes";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider
    attribute="class"
    defaultTheme="dark"
    enableSystem
    disableTransitionOnChange
    storageKey="theme"
  >
    <App />
  </ThemeProvider>,
);
