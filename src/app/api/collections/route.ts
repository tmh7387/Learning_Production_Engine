import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * GET /api/collections
 * List all collections for the user's organization
 */
export async function GET() {
    try {
        const supabase = createServerComponentClient({ cookies });
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: orgMembership } = await supabase
            .from('user_organizations')
            .select('organization_id')
            .eq('user_id', user.id)
            .single();

        if (!orgMembership) {
            return NextResponse.json({ error: 'No organization found' }, { status: 400 });
        }

        const { data: collections, error } = await supabase
            .from('source_collections')
            .select(`
                *,
                collection_sources (
                    id,
                    source_id,
                    order_index,
                    sources (id, title, source_type, status)
                )
            `)
            .eq('organization_id', orgMembership.organization_id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ collections });
    } catch (error) {
        console.error('List collections error:', error);
        return NextResponse.json(
            { error: 'Failed to list collections', details: error instanceof Error ? error.message : 'Unknown' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/collections
 * Create a new collection
 * Body: { title: string, description?: string }
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = createServerComponentClient({ cookies });
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: orgMembership } = await supabase
            .from('user_organizations')
            .select('organization_id')
            .eq('user_id', user.id)
            .single();

        if (!orgMembership) {
            return NextResponse.json({ error: 'No organization found' }, { status: 400 });
        }

        const { title, description } = await request.json();

        if (!title?.trim()) {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 });
        }

        const { data: collection, error } = await supabase
            .from('source_collections')
            .insert({
                organization_id: orgMembership.organization_id,
                title: title.trim(),
                description: description?.trim() || null,
                status: 'building',
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ collection }, { status: 201 });
    } catch (error) {
        console.error('Create collection error:', error);
        return NextResponse.json(
            { error: 'Failed to create collection', details: error instanceof Error ? error.message : 'Unknown' },
            { status: 500 }
        );
    }
}
