export interface RoadmapItem {
  text: string;
  href?: string;
}

export interface RoadmapSection {
  heading: string;
  items: RoadmapItem[];
}

export interface Roadmap {
  sections: RoadmapSection[];
}

const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

function parseItem(raw: string): RoadmapItem {
  const text = raw.trim();
  const link = LINK.exec(text);
  return link ? { text: link[1], href: link[2] } : { text };
}

/**
 * Reads `content/roadmap.md`: each `## ` heading starts a section, in file
 * order, and each `- ` line under it is an item. An item that is exactly one
 * `[text](url)` link keeps its URL. Everything else (the title, comments,
 * prose, blank lines) is ignored.
 */
export function parseRoadmap(markdown: string): Roadmap {
  const sections: RoadmapSection[] = [];
  let inComment = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (inComment) {
      if (line.includes('-->')) inComment = false;
      continue;
    }
    if (line.trimStart().startsWith('<!--')) {
      inComment = !line.includes('-->');
      continue;
    }
    if (line.startsWith('## ')) {
      sections.push({ heading: line.slice(3).trim(), items: [] });
    } else if (line.startsWith('- ') && sections.length > 0) {
      const item = parseItem(line.slice(2));
      if (item.text) sections[sections.length - 1].items.push(item);
    }
  }
  return { sections };
}

/** The items of the section whose heading is exactly `heading`. */
export function roadmapSection(
  roadmap: Roadmap,
  heading: string
): RoadmapItem[] {
  return roadmap.sections.find(s => s.heading === heading)?.items ?? [];
}
