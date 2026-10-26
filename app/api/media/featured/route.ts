import { NextResponse } from 'next/server';
import { mediaProvider } from '@/lib/providers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const categories = await mediaProvider.getFeatured();
    return NextResponse.json(
      { success: true, data: categories },
      {
        headers: {
          'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error: any) {
    console.error('[API /api/media/featured] Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
