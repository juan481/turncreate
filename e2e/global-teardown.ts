import { execSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";

const PID_FILE = path.join(__dirname, "..", ".e2e-emulator.pid");

export default async function globalTeardown() {
  if (!existsSync(PID_FILE)) return;
  const pid = readFileSync(PID_FILE, "utf8").trim();
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    } else {
      process.kill(-Number(pid), "SIGKILL");
    }
  } catch {
    // Ya no estaba corriendo -- nada que limpiar.
  } finally {
    unlinkSync(PID_FILE);
  }
}
