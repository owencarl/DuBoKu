import { NextRequest, NextResponse } from 'next/server';
import { providerRegistry } from '@/lib/providers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const source = searchParams.get('source') || 'all';

  try {
    let results;
    if (source && source !== 'all') {
      const provider = providerRegistry.getProvider(source);
      results = await provider.search(q);
    } else {
      // Parallel aggregated search across all registered sources
      results = await providerRegistry.searchAll(q);
    }

    return NextResponse.json(
      { success: true, data: results },
      {
        headers: {
          'Cache-Control': 's-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error: any) {
    console.error('[API /api/media/search] Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
