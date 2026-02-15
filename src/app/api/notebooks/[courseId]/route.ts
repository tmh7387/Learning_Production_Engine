import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { NotebookLMService } from '@/services/notebooklm/notebookService';

/**
 * GET /api/notebooks/[courseId]
 * Retrieve the notebook status/content for a course.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { courseId: string } }
) {
    try {
        const supabase = createServiceClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: course } = await supabase
            .from('courses')
            .select('id, title, notebook_id')
            .eq('id', params.courseId)
            .single();

        if (!course) {
            return NextResponse.json({ error: 'Course not found' }, { status: 404 });
        }

        const notebookService = new NotebookLMService();
        const content = await notebookService.getNotebookContent(params.courseId);

        return NextResponse.json({
            courseId: course.id,
            courseTitle: course.title,
            notebookId: course.notebook_id,
            hasNotebook: !!course.notebook_id,
            content: content ? {
                title: content.title,
                hasAnalysis: !!content.analysisText,
                hasLessonPlan: !!content.lessonPlanText,
                sourceUrl: content.sourceUrl,
                sourceType: content.sourceType,
            } : null,
        });
    } catch (error) {
        console.error('Notebook GET error:', error);
        return NextResponse.json(
            { error: 'Failed to get notebook info', details: error instanceof Error ? error.message : 'Unknown' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/notebooks/[courseId]
 * Manually trigger notebook creation for an existing course.
 * The actual NotebookLM MCP call happens here.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { courseId: string } }
) {
    try {
        const supabase = createServiceClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const notebookService = new NotebookLMService();
        const content = await notebookService.getNotebookContent(params.courseId);

        if (!content) {
            return NextResponse.json(
                { error: 'No course content found to create notebook' },
                { status: 404 }
            );
        }

        // Return the content that should be used with NotebookLM MCP tools
        // The client or an admin tool can then call the MCP tools with this data
        return NextResponse.json({
            success: true,
            message: 'Notebook content prepared. Use NotebookLM MCP tools to create the notebook.',
            notebookContent: {
                title: content.title,
                analysisText: content.analysisText,
                lessonPlanText: content.lessonPlanText,
                sourceUrl: content.sourceUrl,
                sourceType: content.sourceType,
            },
        });
    } catch (error) {
        console.error('Notebook POST error:', error);
        return NextResponse.json(
            { error: 'Failed to create notebook', details: error instanceof Error ? error.message : 'Unknown' },
            { status: 500 }
        );
    }
}
