import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const PID_FILE = path.join(ROOT, ".e2e-emulator.pid");
const HUB_URL = "http://127.0.0.1:4400/emulators";
// El hub reporta "listo" apenas registra los emuladores, un instante
// antes de que sus puertos realmente acepten conexiones -- por eso se
// esperan también los puertos reales de Firestore y Auth, no sólo el hub.
const READY_URLS = [HUB_URL, "http://127.0.0.1:8080/", "http://127.0.0.1:9099/"];

async function waitForAll(urls: string[], timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  for (const url of urls) {
    for (;;) {
      try {
        await fetch(url);
        break;
      } catch {
        if (Date.now() > deadline) throw new Error(`El Firebase Emulator Suite no respondió a tiempo en ${url}`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
}

export default async function globalSetup() {
  const child = spawn(
    "npx",
    ["firebase-tools", "emulators:start", "--only", "firestore,auth", "--project", "turncreate-e2e"],
    { cwd: ROOT, shell: true, detached: true, stdio: "ignore", windowsHide: true },
  );
  child.unref();
  if (!child.pid) throw new Error("No se pudo arrancar el Firebase Emulator Suite");
  writeFileSync(PID_FILE, String(child.pid), "utf8");

  await waitForAll(READY_URLS, 180_000);

  const seedEnv = {
    ...process.env,
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
    FIREBASE_PROJECT_ID: "turncreate-e2e",
    MP_TOKEN_ENCRYPTION_KEY: "e2e-encryption-key-not-for-production",
  };
  await new Promise<void>((resolve, reject) => {
    const seed = spawn("node", [path.join(ROOT, "scripts", "seed-e2e.cjs")], { cwd: ROOT, env: seedEnv, stdio: "inherit" });
    seed.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`seed-e2e.cjs salió con código ${code}`))));
  });
}
