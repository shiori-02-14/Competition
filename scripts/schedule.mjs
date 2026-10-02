import { runUpdate } from "./update.mjs";

function waitUntilNextRun() {
  const next = new Date();
  next.setHours(7, 10, 0, 0);
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
  return Math.max(60_000, next.getTime() - Date.now());
}

async function tick() {
  try {
    await runUpdate({ oncePerDay: true });
    setTimeout(tick, waitUntilNextRun());
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    setTimeout(tick, 30 * 60 * 1000);
  }
}

tick();
