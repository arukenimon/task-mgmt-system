import { createWriteStream } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { finished } from "node:stream/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const databaseContainer =
  process.env.LOCAL_SUPABASE_DB_CONTAINER ?? "supabase_db_task-management-system";
const backupDirectory = join(process.cwd(), "backups", "local-supabase");

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export async function backupLocalDatabase() {
  await mkdir(backupDirectory, { recursive: true });

  const filename = `task-management-system-${timestamp()}.dump`;
  const backupPath = join(backupDirectory, filename);
  const partialPath = `${backupPath}.partial`;
  const output = createWriteStream(partialPath, { flags: "wx" });

  const command = "docker";
  const args = [
    "exec",
    "-i",
    databaseContainer,
    "pg_dump",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "--format=custom",
  ];

  try {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.stdout.pipe(output);

    const exitCode = await new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("close", resolve);
      output.on("error", reject);
    });

    if (exitCode !== 0) {
      throw new Error(
        `Database backup failed (docker exit code ${exitCode}). ${stderr.trim()}`.trim(),
      );
    }

    await finished(output);
    await rename(partialPath, backupPath);
    return backupPath;
  } catch (error) {
    output.destroy();
    await rm(partialPath, { force: true });
    throw error;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const backupPath = await backupLocalDatabase();
    console.log(`Local database snapshot saved to ${backupPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
