import { NextRequest, NextResponse } from 'next/server';
import {
  getRedis,
  characterShareKey,
  CHARACTER_SHARE_TTL_SECONDS,
} from '@/lib/redis';
import { CharacterExport } from '@/types/character';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { characterId, character } = body as {
      characterId: string;
      character: CharacterExport;
    };

    if (!characterId || !character) {
      return NextResponse.json(
        { error: 'characterId and character are required' },
        { status: 400 }
      );
    }

    // Strip base64 avatars — S3 URLs transfer fine; base64 blobs are too large
    if (character.character?.avatar?.startsWith('data:image/')) {
      character.character.avatar = undefined;
    }

    const redis = getRedis();
    await redis.set(characterShareKey(characterId), JSON.stringify(character), {
      ex: CHARACTER_SHARE_TTL_SECONDS,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error sharing character:', error);
    return NextResponse.json(
      { error: 'Failed to share character' },
      { status: 500 }
    );
  }
}
