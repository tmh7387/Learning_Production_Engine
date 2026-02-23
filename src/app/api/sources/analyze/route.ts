import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { PipelineOrchestrator } from '@/services/orchestrator';

export const maxDuration = 300; // 5-minute timeout for processing

export async function POST(request: NextRequest) {
    try {
        // Authenticate user
        console.log('[AnalyzeRoute] Step 1: Authenticating user...');
        const supabase = createServerComponentClient({ cookies });
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            console.warn('[AnalyzeRoute] Auth failed — no user');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        console.log('[AnalyzeRoute] Authenticated as:', user.email);

        // Get user's organization
        console.log('[AnalyzeRoute] Step 2: Looking up organization...');
        const { data: orgMembership, error: orgError } = await supabase
            .from('user_organizations')
            .select('organization_id')
            .eq('user_id', user.id)
            .single();

        if (orgError) {
            console.error('[AnalyzeRoute] Org lookup error:', orgError);
        }
        if (!orgMembership) {
            console.warn('[AnalyzeRoute] No organization found for user:', user.id);
            return NextResponse.json({ error: 'No organization found' }, { status: 400 });
        }
        console.log('[AnalyzeRoute] Org ID:', orgMembership.organization_id);

        // Parse request
        const body = await request.json();
        const { sourceUrl, sourceType } = body;
        console.log('[AnalyzeRoute] Step 3: Request body:', { sourceUrl, sourceType });

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

        // Run pipeline
        console.log('[AnalyzeRoute] Step 4: Starting pipeline...');
        const orchestrator = new PipelineOrchestrator();
        const result = await orchestrator.processSourceToLesson(
            sourceUrl,
            sourceType,
            orgMembership.organization_id
        );
        console.log('[AnalyzeRoute] Pipeline complete! courseId:', result.courseId);

        return NextResponse.json({
            success: true,
            courseId: result.courseId,
            lesson: result.lesson,
        });
    } catch (error) {
        console.error('[AnalyzeRoute] FATAL ERROR:', error);
        console.error('[AnalyzeRoute] Error type:', typeof error);
        console.error('[AnalyzeRoute] Error message:', error instanceof Error ? error.message : JSON.stringify(error));
        console.error('[AnalyzeRoute] Error stack:', error instanceof Error ? error.stack : 'N/A');
        return NextResponse.json(
            {
                error: 'Analysis failed',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
