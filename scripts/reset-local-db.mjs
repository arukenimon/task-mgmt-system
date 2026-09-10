import { spawn } from "node:child_process";
import { backupLocalDatabase } from "./backup-local-db.mjs";

const resetArgs = process.argv.slice(2);

if (!resetArgs.includes("--confirm")) {
  console.error(
    "Refusing to reset local data. Run: npm run db:reset -- --confirm",
  );
  process.exitCode = 1;
} else if (resetArgs.some((arg) => arg === "--linked" || arg === "--db-url")) {
  console.error(
    "This safety wrapper only permits local resets. It will not reset a linked or explicitly addressed database.",
  );
  process.exitCode = 1;
} else {
  const forwardedArgs = resetArgs.filter((arg) => arg !== "--confirm");

  try {
    const backupPath = await backupLocalDatabase();
    console.log(`Created recovery snapshot: ${backupPath}`);
    console.log("Resetting the local database…");

    const npx = process.platform === "win32" ? "npx.cmd" : "npx";
    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn(npx, ["supabase", "db", "reset", ...forwardedArgs], {
        stdio: "inherit",
      });
      child.on("error", reject);
      child.on("close", resolve);
    });

    process.exitCode = exitCode ?? 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
