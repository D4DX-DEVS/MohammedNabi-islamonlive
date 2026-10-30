// OpenNext copies .env into the built Worker. Keep only the public keys so secrets in .env never ship.
import { readFileSync, writeFileSync } from "node:fs";

const PUBLIC = ["NEXT_PUBLIC_SITE_URL"];

const dotenv = ".open-next/server-functions/default/.env";
writeFileSync(
  dotenv,
  readFileSync(dotenv, "utf8").split(/\r?\n/).filter((l) => PUBLIC.some((k) => l.startsWith(`${k}=`))).join("\n") + "\n",
);

const nextEnv = ".open-next/cloudflare/next-env.mjs";
writeFileSync(
  nextEnv,
  readFileSync(nextEnv, "utf8").replace(/= *(\{.*\});?/g, (_, json) => {
    const kept = Object.fromEntries(Object.entries(JSON.parse(json)).filter(([k]) => PUBLIC.includes(k)));
    return `= ${JSON.stringify(kept)};`;
  }),
);
