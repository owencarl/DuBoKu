import { NextRequest, NextResponse } from 'next/server';
import { providerRegistry } from '@/lib/providers';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { episodeId: string } | Promise<{ episodeId: string }> }
) {
  try {
    const { episodeId } = await Promise.resolve(params);
    const { searchParams } = new URL(request.url);
    const sourceParam = searchParams.get('source') || undefined;

    if (!episodeId) {
      return NextResponse.json({ success: false, error: 'Missing episodeId parameter' }, { status: 400 });
    }

    const { sourceKey, rawId } = providerRegistry.parseSourceAndId(episodeId, sourceParam);
    const provider = providerRegistry.getProvider(sourceKey);
    console.log(`[API /api/media/stream] Using provider "${sourceKey}" for episodeId:`, rawId);

    const stream = await provider.resolveStreamUrl(rawId);
    return NextResponse.json({ success: true, data: stream });
  } catch (error: any) {
    console.error(`[API /api/media/stream] Stream resolution error:`, error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 404 });
  }
}
