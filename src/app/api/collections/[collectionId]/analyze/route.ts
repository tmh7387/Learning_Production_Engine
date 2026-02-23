import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { CollectionAnalyzer } from '@/services/collections/collectionAnalyzer';

export const maxDuration = 300;

/**
 * POST /api/collections/[collectionId]/analyze
 * Trigger cross-source synthesis for a collection
 */
export async function POST(
    _request: Request,
    { params }: { params: { collectionId: string } }
) {
    try {
        const supabase = createServerComponentClient({ cookies });
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify collection exists and has sources
        const { data: collection } = await supabase
            .from('source_collections')
            .select(`
                id,
                collection_sources (id)
            `)
            .eq('id', params.collectionId)
            .single();

        if (!collection) {
            return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
        }

        if (!collection.collection_sources || collection.collection_sources.length < 2) {
            return NextResponse.json(
                { error: 'Collection needs at least 2 sources for cross-source analysis' },
                { status: 400 }
            );
        }

        const analyzer = new CollectionAnalyzer();
        const analysis = await analyzer.analyzeCollection(params.collectionId);

        return NextResponse.json({
            success: true,
            analysis: {
                id: analysis.id,
                sourcesAnalyzed: analysis.sources_analyzed,
                processingTimeMs: analysis.processing_time_ms,
                costUsd: analysis.cost_usd,
            },
        });
    } catch (error) {
        console.error('Collection analysis error:', error);
        return NextResponse.json(
            { error: 'Analysis failed', details: error instanceof Error ? error.message : 'Unknown' },
            { status: 500 }
        );
    }
}
