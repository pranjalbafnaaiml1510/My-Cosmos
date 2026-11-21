/**
 * Writes the synthetic demo corpus + taxonomy to /data/mock so the Python backend serves
 * exactly the same records as the in-browser mock adapter.
 * Run: npm run export:mock
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateCorpus } from "../src/data/mock/generateCorpus";
import { COUNTRIES, DOMAINS } from "../src/data/mock/taxonomy";

const out = resolve(process.cwd(), "../data/mock");
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, "papers.json"), JSON.stringify(generateCorpus()));
writeFileSync(resolve(out, "taxonomy.json"), JSON.stringify({
  _note: "Taxonomy structure. Country weights only shape the synthetic demo distribution.",
  domains: DOMAINS,
  countries: COUNTRIES.map(({ id, name, flag }) => ({ id, name, flag })),
}, null, 2));
console.log(`Wrote demo corpus to ${out}`);
