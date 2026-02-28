import fs from "node:fs";
import path from "node:path";
import { buildFrequencyPayload, loadEvents } from "./pipeline.mjs";

function parseArgs(argv) {
  const args = {
    userId: "demo-user-1",
    windowDays: 3,
    limit: 100,
    lang: null,
    eventsPath: "packages/contracts/fixtures/media.events.sample.json",
    outPath: null,
    nowIso: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === "--userId" && next) {
      args.userId = next;
      i += 1;
    } else if (token === "--windowDays" && next) {
      args.windowDays = Number(next);
      i += 1;
    } else if (token === "--limit" && next) {
      args.limit = Number(next);
      i += 1;
    } else if (token === "--lang" && next) {
      args.lang = next;
      i += 1;
    } else if (token === "--events" && next) {
      args.eventsPath = next;
      i += 1;
    } else if (token === "--out" && next) {
      args.outPath = next;
      i += 1;
    } else if (token === "--now" && next) {
      args.nowIso = next;
      i += 1;
    }
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const events = loadEvents(args.eventsPath);
  const output = buildFrequencyPayload({
    userId: args.userId,
    events,
    windowDays: args.windowDays,
    limit: args.limit,
    nowIso: args.nowIso,
    lang: args.lang
  });

  if (args.outPath) {
    const absolute = path.resolve(args.outPath);
    fs.writeFileSync(absolute, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    console.error(`Wrote vocab frequency to ${absolute}`);
    return;
  }

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main();
