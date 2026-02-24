import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { PipelineOrchestrator } from '@/services/orchestrator';

export const maxDuration = 300; // 5-minute timeout for processing

export async function POST(request: NextRequest) {
    try {
        // Authenticate user
        const supabase = createServerComponentClient({ cookies });
        const {
            data: { user },
        } = await supabase.auth.getUser();

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

        // Parse request
        const body = await request.json();
        const { sourceUrl, sourceType } = body;

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
        const orchestrator = new PipelineOrchestrator();
        const result = await orchestrator.processSourceToLesson(
            sourceUrl,
            sourceType,
            orgMembership.organization_id
        );

        return NextResponse.json({
            success: true,
            courseId: result.courseId,
            lesson: result.lesson,
        });
    } catch (error) {
        console.error('Analysis error:', error);
        return NextResponse.json(
            {
                error: 'Analysis failed',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
