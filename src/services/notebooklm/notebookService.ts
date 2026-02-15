/**
 * NotebookLM Integration Service
 *
 * Creates NotebookLM notebooks populated with course source materials
 * and generated analyses/lesson plans for deeper AI-powered exploration.
 *
 * Note: This service is designed to be called from server-side code only
 * (API routes / services). The actual NotebookLM MCP calls are made via
 * a REST API wrapper — in development, the MCP tools handle this directly.
 */

import { createServiceClient } from '@/lib/supabase/server';

interface NotebookCreationResult {
    notebookId: string;
    title: string;
    sourcesAdded: number;
}

interface CourseData {
    id: string;
    title: string;
    description?: string;
}

interface AnalysisData {
    analysisData: Record<string, unknown>;
    modelUsed?: string;
}

export class NotebookLMService {
    private supabase;

    constructor() {
        this.supabase = createServiceClient();
    }

    /**
     * Create a NotebookLM notebook for a course, populated with:
     * - Source URL (for YouTube sources)
     * - Analysis text (pasted as text source)
     * - Generated lesson plan summary (pasted as text source)
     */
    async createNotebookForCourse(
        course: CourseData,
        analysis: AnalysisData,
        sourceUrl?: string,
        sourceType?: 'youtube' | 'pdf' | 'pptx'
    ): Promise<NotebookCreationResult | null> {
        try {
            // Build the notebook content from analysis data
            const notebookTitle = `LEP: ${course.title}`;
            let sourcesAdded = 0;

            // Format analysis as readable text
            const analysisText = this.formatAnalysisAsText(analysis, course.title);

            // Format lesson plan summary
            const lessonSummary = await this.getLessonPlanSummary(course.id);

            // Store the notebook metadata in Supabase
            // The actual NotebookLM notebook creation happens via the MCP tools
            // which are called from the API route handler
            const notebookId = `pending_${course.id}_${Date.now()}`;

            // Save metadata for later MCP-based creation
            const { error } = await this.supabase
                .from('courses')
                .update({ notebook_id: notebookId })
                .eq('id', course.id);

            if (error) {
                console.error('Failed to store notebook ID:', error.message);
                return null;
            }

            // Count sources that will be added
            if (sourceUrl && sourceType === 'youtube') sourcesAdded++;
            if (analysisText) sourcesAdded++;
            if (lessonSummary) sourcesAdded++;

            console.log(`[NotebookLM] Prepared notebook for course "${course.title}" with ${sourcesAdded} sources`);

            return {
                notebookId,
                title: notebookTitle,
                sourcesAdded,
            };
        } catch (error) {
            console.error('[NotebookLM] Failed to create notebook:', error);
            return null;
        }
    }

    /**
     * Actually create the notebook in NotebookLM via API.
     * This is called from the API route where MCP tools are available.
     */
    async getNotebookContent(courseId: string): Promise<{
        title: string;
        analysisText: string;
        lessonPlanText: string;
        sourceUrl?: string;
        sourceType?: string;
    } | null> {
        try {
            // Get course info
            const { data: course } = await this.supabase
                .from('courses')
                .select('id, title, description')
                .eq('id', courseId)
                .single();

            if (!course) return null;

            // Get linked source info
            const { data: mappings } = await this.supabase
                .from('lesson_source_mappings')
                .select('source_id')
                .eq('module_id', courseId);

            // Get source details via modules
            const { data: modules } = await this.supabase
                .from('modules')
                .select('id')
                .eq('course_id', courseId);

            let sourceUrl: string | undefined;
            let sourceType: string | undefined;

            if (modules && modules.length > 0) {
                const { data: mapping } = await this.supabase
                    .from('lesson_source_mappings')
                    .select('source_id')
                    .eq('module_id', modules[0].id)
                    .single();

                if (mapping) {
                    const { data: source } = await this.supabase
                        .from('sources')
                        .select('source_url, source_type')
                        .eq('id', mapping.source_id)
                        .single();

                    if (source) {
                        sourceUrl = source.source_url;
                        sourceType = source.source_type;
                    }
                }
            }

            // Get analysis data
            let analysisText = '';
            if (modules && modules.length > 0) {
                const { data: mapping } = await this.supabase
                    .from('lesson_source_mappings')
                    .select('source_id')
                    .eq('module_id', modules[0].id)
                    .single();

                if (mapping) {
                    const { data: analysisData } = await this.supabase
                        .from('source_analyses')
                        .select('analysis_data')
                        .eq('source_id', mapping.source_id)
                        .single();

                    if (analysisData) {
                        analysisText = JSON.stringify(analysisData.analysis_data, null, 2);
                    }
                }
            }

            // Get lesson plan text
            const lessonPlanText = await this.getLessonPlanSummary(courseId);

            return {
                title: `LEP: ${course.title}`,
                analysisText,
                lessonPlanText: lessonPlanText || '',
                sourceUrl,
                sourceType,
            };
        } catch (error) {
            console.error('[NotebookLM] Failed to get notebook content:', error);
            return null;
        }
    }

    /**
     * Format analysis data as human-readable text for NotebookLM ingestion.
     */
    private formatAnalysisAsText(analysis: AnalysisData, courseTitle: string): string {
        const sections: string[] = [
            `# Source Analysis: ${courseTitle}`,
            `Model: ${analysis.modelUsed || 'Gemini 1.5 Pro'}`,
            '',
        ];

        const data = analysis.analysisData;
        if (typeof data === 'object' && data !== null) {
            for (const [key, value] of Object.entries(data)) {
                sections.push(`## ${key}`);
                if (typeof value === 'string') {
                    sections.push(value);
                } else {
                    sections.push(JSON.stringify(value, null, 2));
                }
                sections.push('');
            }
        }

        return sections.join('\n');
    }

    /**
     * Build a text summary of the lesson plan for NotebookLM.
     */
    private async getLessonPlanSummary(courseId: string): Promise<string | null> {
        try {
            const { data: modules } = await this.supabase
                .from('modules')
                .select('id, title, module_number, description, duration')
                .eq('course_id', courseId)
                .order('module_number');

            if (!modules || modules.length === 0) return null;

            const sections: string[] = ['# Generated Lesson Plan\n'];

            for (const mod of modules) {
                sections.push(`## Module ${mod.module_number}: ${mod.title}`);
                if (mod.description) sections.push(mod.description);
                if (mod.duration) sections.push(`Duration: ${mod.duration} minutes`);
                sections.push('');

                const { data: objectives } = await this.supabase
                    .from('learning_objectives')
                    .select('id, objective_type, content, blooms_level, order_index')
                    .eq('module_id', mod.id)
                    .order('order_index');

                if (objectives) {
                    for (const obj of objectives) {
                        sections.push(`### ${obj.objective_type}: ${obj.content}`);
                        sections.push(`Bloom's Level: ${obj.blooms_level}`);

                        const { data: activities } = await this.supabase
                            .from('learning_activities')
                            .select('instruction_method, description, duration')
                            .eq('learning_objective_id', obj.id)
                            .order('order_index');

                        if (activities) {
                            for (const act of activities) {
                                sections.push(`- **${act.instruction_method}** (${act.duration} min): ${act.description}`);
                            }
                        }
                        sections.push('');
                    }
                }
            }

            return sections.join('\n');
        } catch (error) {
            console.error('[NotebookLM] Failed to build lesson summary:', error);
            return null;
        }
    }
}
