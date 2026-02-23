import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { CollectionOrchestrator } from '@/services/collections/collectionOrchestrator';

export const maxDuration = 300; // 5-minute timeout for source processing

/**
 * POST /api/collections/[collectionId]/sources
 * Add a source to a collection
 * Body: { sourceUrl: string, sourceType: 'youtube' | 'pdf' | 'pptx' }
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { collectionId: string } }
) {
    try {
        const supabase = createServerComponentClient({ cookies });
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify collection exists
        const { data: collection } = await supabase
            .from('source_collections')
            .select('id')
            .eq('id', params.collectionId)
            .single();

        if (!collection) {
            return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
        }

        const { sourceUrl, sourceType, fileBuffer: fileBufferBase64, fileName } = await request.json();

        if (!sourceUrl || !sourceType) {
            return NextResponse.json(
                { error: 'sourceUrl and sourceType are required' },
                { status: 400 }
            );
        }

        if (!['youtube', 'pdf', 'pptx'].includes(sourceType)) {
            return NextResponse.json(
                { error: 'sourceType must be youtube, pdf, or pptx' },
                { status: 400 }
            );
        }

        // Decode file buffer if provided (for PDF/PPTX uploads)
        let fileBuffer: Buffer | undefined;
        if (fileBufferBase64) {
            fileBuffer = Buffer.from(fileBufferBase64, 'base64');
        }

        const orchestrator = new CollectionOrchestrator();
        const sourceId = await orchestrator.addSourceToCollection(
            params.collectionId,
            sourceUrl,
            sourceType,
            fileBuffer,
            fileName
        );

        return NextResponse.json({
            success: true,
            sourceId,
            message: `Source added and analyzed successfully`,
        }, { status: 201 });
    } catch (error) {
        console.error('Add source to collection error:', error);
        return NextResponse.json(
            { error: 'Failed to add source', details: error instanceof Error ? error.message : 'Unknown' },
            { status: 500 }
        );
    }
}
