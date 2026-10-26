import { NextRequest, NextResponse } from 'next/server';
import { mediaProvider } from '@/lib/providers';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { episodeId: string } | Promise<{ episodeId: string }> }
) {
  try {
    const { episodeId } = await Promise.resolve(params);
    console.log(`[API /api/media/stream] Incoming requested episodeId:`, episodeId);

    if (!episodeId) {
      return NextResponse.json({ success: false, error: 'Missing episodeId parameter' }, { status: 400 });
    }

    const stream = await mediaProvider.resolveStreamUrl(episodeId);
    console.log(`[API /api/media/stream] Resolved streamUrl for ${episodeId}:`, stream.streamUrl);

    return NextResponse.json({ success: true, data: stream });
  } catch (error: any) {
    console.error(`[API /api/media/stream] Stream resolution error:`, error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 404 });
  }
}
