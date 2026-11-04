import { config } from "../config";
import { openDb } from "./connection";
import { migrate } from "./migrate";
import { clearDemo, seedDemo } from "./seed";

const command = process.argv[2];
const db = openDb(config.dbPath);

try {
  const applied = migrate(db);
  if (command === "migrate") {
    console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Database is up to date.");
  } else if (command === "seed") {
    const { projectId, created } = await seedDemo(db);
    console.log(created ? `Demo data created (project id ${projectId}).` : "Demo project already exists; nothing to do.");
  } else if (command === "clear-demo") {
    const removed = clearDemo(db);
    console.log("Removed demo rows:", removed);
  } else {
    console.error("Usage: tsx src/db/cli.ts <migrate|seed|clear-demo>");
    process.exitCode = 1;
  }
  console.log(`Database: ${config.dbPath}`);
} finally {
  db.close();
}
