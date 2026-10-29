import { NextResponse } from 'next/server';
import { providerRegistry } from '@/lib/providers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sources = providerRegistry.getProviderList();
    return NextResponse.json(
      { success: true, data: sources },
      {
        headers: {
          'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error: any) {
    console.error('[API /api/sources] Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
