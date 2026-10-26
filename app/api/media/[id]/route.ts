import { NextRequest, NextResponse } from 'next/server';
import { mediaProvider } from '@/lib/providers';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    console.log(`[API /api/media/[id]] Incoming requested ID:`, id);

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing ID parameter' }, { status: 400 });
    }

    const item = await mediaProvider.getDetails(id);
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
