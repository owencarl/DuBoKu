import { NextRequest, NextResponse } from 'next/server';
import { providerRegistry } from '@/lib/providers';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const { searchParams } = new URL(request.url);
    const sourceParam = searchParams.get('source') || undefined;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing ID parameter' }, { status: 400 });
    }

    const { sourceKey, rawId } = providerRegistry.parseSourceAndId(id, sourceParam);
    const provider = providerRegistry.getProvider(sourceKey);
    console.log(`[API /api/media/[id]] Using provider "${sourceKey}" for ID:`, rawId);

    const item = await provider.getDetails(rawId);
    return NextResponse.json(
      { success: true, data: item },
      {
        headers: {
          'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error: any) {
    console.error(`[API /api/media/[id]] Failed to get details:`, error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 404 });
  }
}
