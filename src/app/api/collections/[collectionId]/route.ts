import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * GET /api/collections/[collectionId]
 * Get a collection with its sources and analysis
 */
export async function GET(
    _request: Request,
    { params }: { params: { collectionId: string } }
) {
    try {
        const supabase = createServerComponentClient({ cookies });
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: collection, error } = await supabase
            .from('source_collections')
            .select(`
                *,
                collection_sources (
                    id,
                    source_id,
                    order_index,
                    sources (id, title, source_type, source_url, status, created_at)
                ),
                collection_analyses (
                    id,
                    analysis_type,
                    analysis_data,
                    sources_analyzed,
                    processing_time_ms,
                    cost_usd,
                    created_at
                )
            `)
            .eq('id', params.collectionId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
            }
            throw error;
        }

        return NextResponse.json({ collection });
    } catch (error) {
        console.error('Get collection error:', error);
        return NextResponse.json(
            { error: 'Failed to get collection', details: error instanceof Error ? error.message : 'Unknown' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/collections/[collectionId]
 * Delete a collection and its junction records
 */
export async function DELETE(
    _request: Request,
    { params }: { params: { collectionId: string } }
) {
    try {
        const supabase = createServerComponentClient({ cookies });
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Delete junction records first
        await supabase
            .from('collection_sources')
            .delete()
            .eq('collection_id', params.collectionId);

        await supabase
            .from('collection_analyses')
            .delete()
            .eq('collection_id', params.collectionId);

        const { error } = await supabase
            .from('source_collections')
            .delete()
            .eq('id', params.collectionId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete collection error:', error);
        return NextResponse.json(
            { error: 'Failed to delete collection', details: error instanceof Error ? error.message : 'Unknown' },
            { status: 500 }
        );
    }
}
