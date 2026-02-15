import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { ClaudeLessonService } from '@/services/claude/lessonGeneration';
import { NotebookLMService } from '@/services/notebooklm/notebookService';

/**
 * POST /api/sources/from-notebook
 *
 * Generate a lesson plan from a NotebookLM notebook.
 * Queries the notebook to extract content, then feeds it to Claude for lesson generation.
 *
 * Body: { notebookId: string, organizationId: string }
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = createServiceClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { notebookId, organizationId, notebookContent } = await request.json();

        if (!notebookId || !organizationId) {
            return NextResponse.json(
                { error: 'notebookId and organizationId are required' },
                { status: 400 }
            );
        }

        // If notebookContent is provided directly (from MCP query), use it.
        // Otherwise, we'll need the content to be provided by the client
        // since MCP calls can't be made directly from API routes.
        if (!notebookContent || !notebookContent.text) {
            return NextResponse.json(
                {
                    error: 'notebookContent.text is required',
                    hint: 'Query the NotebookLM notebook using MCP tools first, then pass the content here.',
                },
                { status: 400 }
            );
        }

        // Step 1: Create a source record for the notebook
        const { data: source, error: sourceError } = await supabase
            .from('sources')
            .insert({
                organization_id: organizationId,
                source_type: 'notebooklm',
                source_url: `notebooklm://${notebookId}`,
                title: notebookContent.title || `NotebookLM: ${notebookId}`,
                status: 'processing',
            })
            .select()
            .single();

        if (sourceError) {
            return NextResponse.json(
                { error: `Failed to create source: ${sourceError.message}` },
                { status: 500 }
            );
        }

        try {
            // Step 2: Save the notebook content as an analysis
            const analysisData = {
                source: 'NotebookLM',
                notebookId,
                content: notebookContent.text,
                summary: notebookContent.summary || '',
                topics: notebookContent.topics || [],
            };

            await supabase.from('source_analyses').insert({
                source_id: source.id,
                analysis_type: 'notebooklm_content',
                analysis_data: analysisData,
                model_used: 'NotebookLM',
            });

            // Step 3: Generate lesson plan with Claude
            const claudeService = new ClaudeLessonService();
            const lesson = await claudeService.generateLesson(
                analysisData,
                notebookContent.title || 'NotebookLM Source'
            );

            // Step 4: Save lesson plan (course, modules, objectives, activities)
            const { data: course, error: courseError } = await supabase
                .from('courses')
                .insert({
                    organization_id: organizationId,
                    title: lesson.course.title,
                    description: lesson.course.description,
                    status: 'draft',
                    notebook_id: notebookId,
                })
                .select()
                .single();

            if (courseError) throw new Error(`Failed to create course: ${courseError.message}`);

            for (const mod of lesson.modules) {
                const { data: module, error: modError } = await supabase
                    .from('modules')
                    .insert({
                        course_id: course.id,
                        module_number: mod.moduleNumber,
                        title: mod.title,
                        description: mod.description,
                        duration: mod.duration,
                    })
                    .select()
                    .single();

                if (modError) throw new Error(`Failed to create module: ${modError.message}`);

                await supabase.from('lesson_source_mappings').insert({
                    source_id: source.id,
                    module_id: module.id,
                });

                for (let i = 0; i < mod.objectives.length; i++) {
                    const obj = mod.objectives[i];

                    const { data: objective, error: objError } = await supabase
                        .from('learning_objectives')
                        .insert({
                            module_id: module.id,
                            objective_type: obj.type,
                            content: obj.content,
                            blooms_level: obj.bloomsLevel,
                            order_index: i,
                        })
                        .select()
                        .single();

                    if (objError) throw new Error(`Failed to create objective: ${objError.message}`);

                    for (let j = 0; j < obj.activities.length; j++) {
                        const act = obj.activities[j];
                        await supabase.from('learning_activities').insert({
                            learning_objective_id: objective.id,
                            instruction_method: act.instructionMethod,
                            description: act.description,
                            duration: act.duration,
                            resources: act.resources,
                            order_index: j,
                        });
                    }
                }
            }

            // Step 5: Mark source complete
            await supabase
                .from('sources')
                .update({ status: 'completed', updated_at: new Date().toISOString() })
                .eq('id', source.id);

            return NextResponse.json({
                success: true,
                courseId: course.id,
                sourceId: source.id,
                modulesCreated: lesson.modules.length,
            });
        } catch (processingError) {
            // Mark source as failed
            await supabase
                .from('sources')
                .update({ status: 'failed', updated_at: new Date().toISOString() })
                .eq('id', source.id);

            throw processingError;
        }
    } catch (error) {
        console.error('From-notebook route error:', error);
        return NextResponse.json(
            { error: 'Failed to generate from notebook', details: error instanceof Error ? error.message : 'Unknown' },
            { status: 500 }
        );
    }
}
