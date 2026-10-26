import { NextRequest, NextResponse } from 'next/server';
import { mediaProvider } from '@/lib/providers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';

  try {
    const results = await mediaProvider.search(q);
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
