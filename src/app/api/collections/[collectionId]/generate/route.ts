import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { CollectionOrchestrator } from '@/services/collections/collectionOrchestrator';

export const maxDuration = 300;

/**
 * POST /api/collections/[collectionId]/generate
 * Full pipeline: analyze collection → generate lesson plan → save course
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

        // Get user's organization
        const { data: orgMembership } = await supabase
            .from('user_organizations')
            .select('organization_id')
            .eq('user_id', user.id)
            .single();

        if (!orgMembership) {
            return NextResponse.json({ error: 'No organization found' }, { status: 400 });
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

        if (!collection.collection_sources || collection.collection_sources.length === 0) {
            return NextResponse.json(
                { error: 'Collection has no sources' },
                { status: 400 }
            );
        }

        const orchestrator = new CollectionOrchestrator();
        const result = await orchestrator.processCollectionToLesson(
            params.collectionId,
            orgMembership.organization_id
        );

        return NextResponse.json({
            success: true,
            courseId: result.courseId,
            lesson: result.lesson,
        });
    } catch (error) {
        console.error('Collection generate error:', error);
        return NextResponse.json(
            { error: 'Generation failed', details: error instanceof Error ? error.message : 'Unknown' },
            { status: 500 }
        );
    }
}
