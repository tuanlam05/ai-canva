import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createApp } from "./app.js";
import { findPort } from "./findPort.js";

dotenv.config();

const PREFERRED_PORT = Number(process.env.PORT) || 3001;

// Resolve the project root (two levels up from src/index.ts / dist/index.js)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const PORT_FILE = path.join(PROJECT_ROOT, ".server-port");

const app = createApp();

// Find an available port (auto-increments if the preferred port is in use)
findPort(PREFERRED_PORT).then((actualPort) => {
  // Write the actual port to a file so the Vite client can read it
  // and proxy /api requests to the correct server address.
  fs.writeFileSync(PORT_FILE, String(actualPort));

  // Remove it again on shutdown. A stale file from a previous run would send
  // the next Vite start to a dead port (Vite reads it before this server has
  // rewritten it); with no file, Vite waits for the new one instead.
  const removePortFile = () => {
    try {
      if (fs.readFileSync(PORT_FILE, "utf-8").trim() === String(actualPort)) {
        fs.unlinkSync(PORT_FILE);
      }
    } catch {
      // Already gone — nothing to clean up.
    }
  };
  process.on("exit", removePortFile);
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.on(signal, () => process.exit(0));
  }

  app.listen(actualPort, () => {
    if (actualPort !== PREFERRED_PORT) {
      console.warn(
        `[server] Port ${PREFERRED_PORT} was in use — switched to ${actualPort}`
      );
    }
    console.log(`[server] Running on http://localhost:${actualPort}`);

    if (!process.env.OLLAMA_API_KEY) {
      console.warn(
        "[server] OLLAMA_API_KEY not set — AI generation will fail. Add it to server/.env"
      );
    }
  });
});
