import type { NextRequest } from 'next/server';
import {
  handleFogAppearanceGet,
  handleFogAppearancePut,
  type FogAppearanceRouteContext,
} from '@/lib/fogAppearanceRouteHandlers';

export async function GET(
  request: NextRequest,
  context: FogAppearanceRouteContext
) {
  return handleFogAppearanceGet(request, context);
}

export async function PUT(
  request: NextRequest,
  context: FogAppearanceRouteContext
) {
  return handleFogAppearancePut(request, context);
}
