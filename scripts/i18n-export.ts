import { mkdirSync, writeFileSync } from "node:fs";
import { LOCALES } from "../src/i18n/config";
import { catalogForTranslationTool } from "../src/i18n/tooling";

const outDir = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : "i18n/catalog";

if (!outDir) {
  console.error("Missing directory after --out");
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

for (const locale of LOCALES) {
  const catalog = catalogForTranslationTool(locale);
  writeFileSync(`${outDir}/${locale}.json`, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`${locale}: ${Object.keys(catalog.messages).length} keys, ${catalog.missing.length} missing`);
}
