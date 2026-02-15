import { NextRequest, NextResponse } from 'next/server';
import { pipelineOrchestrator } from '@/services/orchestrator';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const maxDuration = 300; // 5 minutes max execution time

interface AnalyzeRequestBody {
    sourceType: 'youtube' | 'pdf' | 'pptx' | 'url';
    sourceUrl: string;
    options?: {
        duration?: number;
        audience?: string;
        template?: 'iata' | 'custom';
    };
}

export async function POST(request: NextRequest) {
    try {
        // 1. Authenticate user
        const supabase = createRouteHandlerClient({ cookies });
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // 2. Get user's organization
        const { data: userOrg, error: orgError } = await supabase
            .from('user_organizations')
            .select('organization_id')
            .eq('user_id', user.id)
            .single();

        if (orgError || !userOrg) {
            return NextResponse.json(
                { error: 'No organization found' },
                { status: 400 }
            );
        }

        // 3. Parse request body
        const body: AnalyzeRequestBody = await request.json();

        // 4. Validate input
        if (!body.sourceUrl || !body.sourceType) {
            return NextResponse.json(
                { error: 'Missing required fields: sourceUrl and sourceType' },
                { status: 400 }
            );
        }

        // 5. Orchestrate the pipeline
        const result = await pipelineOrchestrator.processSourceToLesson(
            body.sourceType,
            body.sourceUrl,
            {
                ...body.options,
                organizationId: userOrg.organization_id,
                userId: user.id,
            }
        );

        // 6. Return success response
        return NextResponse.json({
            success: true,
            courseId: result.courseId,
            moduleId: result.moduleId,
            message: 'Lesson plan generated successfully',
        });

    } catch (error) {
        console.error('Source analysis error:', error);

        return NextResponse.json(
            {
                error: 'Analysis failed',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}