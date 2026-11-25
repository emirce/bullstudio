import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Config } from "@react-router/dev/config";
import { createGetUrl, getSlugs } from "fumadocs-core/source";

const getUrl = createGetUrl("/docs");
const docsDir = fileURLToPath(new URL("./content/docs", import.meta.url));

const getComparisonUrl = createGetUrl("/comparisons");
const comparisonsDir = fileURLToPath(
  new URL("./content/comparisons", import.meta.url),
);

async function getMdxFiles(directory: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      files.push(
        ...(await getMdxFiles(join(directory, entry.name), relativePath)),
      );
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".mdx")) {
      files.push(relativePath);
    }
  }

  return files;
}

export default {
  ssr: false,
  async prerender({ getStaticPaths }) {
    const paths: string[] = [];
    const excluded: string[] = [];

    for (const path of getStaticPaths()) {
      if (!excluded.includes(path)) paths.push(path);
    }

    for (const entry of await getMdxFiles(docsDir)) {
      const slugs = getSlugs(entry);
      paths.push(
        getUrl(slugs),
        `/llms.mdx/docs/${[...slugs, "content.md"].join("/")}`,
      );
    }

    // Prerender each "Bullstudio vs X" article so it ships as static,
    // crawlable HTML (the whole point — these exist for SEO).
    for (const entry of await getMdxFiles(comparisonsDir)) {
      paths.push(getComparisonUrl(getSlugs(entry)));
    }

    return paths;
  },
} satisfies Config;
