import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/dnd_5e_tracker/" : "/",
  plugins: [react()],
  server: {
    port: parseInt(process.env.PORT || "5173"),
    strictPort: true,
  },
}));
