import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

interface BaseItem {
  name: string;
  type: string;
  source: string;
}

interface ItemsBaseJson {
  baseitem: BaseItem[];
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'json', 'items-base.json');
    const raw = await fs.readFile(filePath, 'utf-8');
    const data: ItemsBaseJson = JSON.parse(raw);

    const seen = new Map<string, string>();

    const artisans: string[] = [];
    const instruments: string[] = [];

    for (const item of data.baseitem) {
      const isAT = item.type === 'AT' || item.type === 'AT|XPHB';
      const isINS = item.type === 'INS' || item.type === 'INS|XPHB';
      if (!isAT && !isINS) continue;

      const key = item.name.toLowerCase();
      const existing = seen.get(key);
      if (existing) {
        // Prefer PHB source over others for deduplication
        if (item.source !== 'PHB') continue;
      }
      seen.set(key, item.source);

      const list = isAT ? artisans : instruments;
      if (!existing) {
        list.push(item.name);
      } else if (item.source === 'PHB') {
        // Replace the non-PHB entry
        const targetList = isAT ? artisans : instruments;
        const idx = targetList.findIndex(n => n.toLowerCase() === key);
        if (idx >= 0) targetList[idx] = item.name;
      }
    }

    return NextResponse.json({
      artisans: artisans.sort(),
      instruments: instruments.sort(),
    });
  } catch (error) {
    console.error('Error loading tools data:', error);
    return NextResponse.json(
      { error: 'Failed to load tools data' },
      { status: 500 }
    );
  }
}
