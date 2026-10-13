import { NextResponse } from 'next/server';

/**
 * Retired map-pinned display key. The campaign display capability replaces
 * it (PR05 E3): this route always answers 426 and never mints a plaintext
 * key, so an old client is told to use Open display instead.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Use Open display from a Table scene or the campaign page' },
    { status: 426 }
  );
}
