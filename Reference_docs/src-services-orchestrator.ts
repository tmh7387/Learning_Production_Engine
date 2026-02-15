import { supabase } from '@/lib/supabase/server';
import { geminiVideoService } from './gemini/videoAnalysis';
import { geminiDocumentService } from './gemini/documentAnalysis';
import { claudeLessonService } from './claude/lessonGeneration';
import { youtubeService } from './sources/youtube';
import type { Source, SourceType, GeneratedLesson } from '@/types';

interface OrchestrationOptions {
    duration?: number;
    audience?: string;
    template?: 'iata' | 'custom';
    organizationId: string;
    userId: string;
}

/**
 * Main orchestration service that coordinates the entire pipeline:
 * Source → Analysis → Lesson Generation → Database Storage
 */
export class PipelineOrchestrator {
    /**
     * Process a source from URL to complete lesson plan
     */
    async processSourceToLesson(
        sourceType: SourceType,
        sourceUrl: string,
        options: OrchestrationOptions
    ): Promise<{ courseId: string; moduleId: string }> {
        try {
            // 1. Create source record
            const source = await this.createSource(sourceType, sourceUrl, options.organizationId, options.userId);

            // 2. Download/prepare source content
            const localPath = await this.prepareSource(sourceType, sourceUrl, source.id);

            // 3. Analyze with Gemini
            await this.updateSourceStatus(source.id, 'processing');
            const analysis = await this.analyzeSource(sourceType, localPath, source.id);

            // 4. Save analysis to database
            await this.saveAnalysis(analysis);

            // 5. Generate lesson with Claude
            const lesson = await claudeLessonService.generateLessonFromAnalysis(
                analysis.analysis_data,
                {
                    duration: options.duration,
                    audience: options.audience,
                    template: options.template,
                }
            );

            // 6. Save lesson to database
            const { courseId, moduleId } = await this.saveLessonToDatabase(
                lesson,
                source.id,
                options.organizationId,
                options.userId
            );

            // 7. Update source status
            await this.updateSourceStatus(source.id, 'completed');

            return { courseId, moduleId };
        } catch (error) {
            console.error('Pipeline orchestration error:', error);
            throw error;
        }
    }

    /**
     * Create source record in database
     */
    private async createSource(
        sourceType: SourceType,
        sourceUrl: string,
        organizationId: string,
        userId: string
    ): Promise<Source> {
        const { data, error } = await supabase
            .from('sources')
            .insert({
                organization_id: organizationId,
                source_type: sourceType,
                source_url: sourceUrl,
                status: 'pending',
                created_by: userId,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Download and prepare source content
     */
    private async prepareSource(
        sourceType: SourceType,
        sourceUrl: string,
        sourceId: string
    ): Promise<string> {
        switch (sourceType) {
            case 'youtube':
                return await youtubeService.downloadVideo(sourceUrl, sourceId);
            case 'pdf':
            case 'pptx':
                // Assume file is already uploaded to Supabase Storage
                // Return the local path
                return sourceUrl;
            default:
                throw new Error(`Unsupported source type: ${sourceType}`);
        }
    }

    /**
     * Analyze source with appropriate Gemini service
     */
    private async analyzeSource(
        sourceType: SourceType,
        localPath: string,
        sourceId: string
    ) {
        switch (sourceType) {
            case 'youtube':
                return await geminiVideoService.analyzeVideo(localPath, sourceId);
            case 'pdf':
                return await geminiDocumentService.analyzePDF(localPath, sourceId);
            case 'pptx':
                return await geminiDocumentService.analyzePPTX(localPath, sourceId);
            default:
                throw new Error(`Unsupported source type: ${sourceType}`);
        }
    }

    /**
     * Save analysis to database
     */
    private async saveAnalysis(analysis: any) {
        const { error } = await supabase
            .from('source_analyses')
            .insert(analysis);

        if (error) throw error;
    }

    /**
     * Update source status
     */
    private async updateSourceStatus(sourceId: string, status: string, errorMessage?: string) {
        const { error } = await supabase
            .from('sources')
            .update({
                status,
                error_message: errorMessage,
                updated_at: new Date().toISOString(),
            })
            .eq('id', sourceId);

        if (error) throw error;
    }

    /**
     * Save generated lesson to database
     */
    private async saveLessonToDatabase(
        lesson: GeneratedLesson,
        sourceId: string,
        organizationId: string,
        userId: string
    ): Promise<{ courseId: string; moduleId: string }> {
        // 1. Create course
        const { data: course, error: courseError } = await supabase
            .from('courses')
            .insert({
                organization_id: organizationId,
                title: lesson.module.title,
                description: lesson.module.rationale,
                status: 'draft',
                created_by: userId,
            })
            .select()
            .single();

        if (courseError) throw courseError;

        // 2. Create module
        const { data: module, error: moduleError } = await supabase
            .from('modules')
            .insert({
                course_id: course.id,
                ...lesson.module,
            })
            .select()
            .single();

        if (moduleError) throw moduleError;

        // 3. Create objectives
        const objectivesWithModuleId = lesson.objectives.map((obj) => ({
            module_id: module.id,
            ...obj,
        }));

        const { data: savedObjectives, error: objectivesError } = await supabase
            .from('learning_objectives')
            .insert(objectivesWithModuleId)
            .select();

        if (objectivesError) throw objectivesError;

        // 4. Create activities (link to objectives)
        const activitiesWithObjectiveIds = lesson.activities.map((activity) => {
            // Find corresponding objective by order_num
            const linkedObjective = savedObjectives.find(
                (obj) => obj.order_num === activity.learning_objective_id
            );

            return {
                learning_objective_id: linkedObjective?.id || savedObjectives[0].id,
                instruction_method: activity.instruction_method,
                description: activity.description,
                duration_minutes: activity.duration_minutes,
                materials: activity.materials,
                order_num: activity.order_num,
            };
        });

        const { error: activitiesError } = await supabase
            .from('learning_activities')
            .insert(activitiesWithObjectiveIds);

        if (activitiesError) throw activitiesError;

        // 5. Link source to module
        const { error: mappingError } = await supabase
            .from('lesson_source_mappings')
            .insert({
                module_id: module.id,
                source_id: sourceId,
                contribution_notes: 'Auto-generated from source analysis',
            });

        if (mappingError) throw mappingError;

        return { courseId: course.id, moduleId: module.id };
    }
}

export const pipelineOrchestrator = new PipelineOrchestrator();