import { NextRequest, NextResponse } from 'next/server';
import { providerRegistry } from '@/lib/providers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') || undefined;
    const provider = providerRegistry.getProvider(source);
    const categories = await provider.getFeatured();

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
