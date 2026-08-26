import { NextRequest, NextResponse } from 'next/server';
import {
  uploadNpcPortraitToS3,
  generateNpcPortraitFileName,
} from '@/utils/s3Upload';

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const npcId = formData.get('npcId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!npcId) {
      return NextResponse.json(
        { error: 'NPC ID is required' },
        { status: 400 }
      );
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File size must be less than ${MAX_FILE_SIZE_MB}MB` },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = generateNpcPortraitFileName(npcId, file.name);
    const url = await uploadNpcPortraitToS3(buffer, fileName, file.type);

    return NextResponse.json({ url }, { status: 200 });
  } catch (error) {
    console.error('NPC portrait upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload NPC portrait' },
      { status: 500 }
    );
  }
}
