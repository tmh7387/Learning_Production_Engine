import { createServiceClient } from '@/lib/supabase/server';
import { GeminiVideoService } from '@/services/gemini/videoAnalysis';
import { GeminiDocumentService } from '@/services/gemini/documentAnalysis';
import { ClaudeLessonService } from '@/services/claude/lessonGeneration';
import { NotebookLMService } from '@/services/notebooklm/notebookService';
import { YouTubeService } from '@/services/sources/youtube';
import { GeneratedLesson } from '@/types/lessons';
import { SourceAnalysis } from '@/types/analysis';

type StatusCallback = (status: string) => void;

export class PipelineOrchestrator {
    private supabase;
    private geminiVideo: GeminiVideoService;
    private geminiDocument: GeminiDocumentService;
    private claudeLesson: ClaudeLessonService;
    private notebookLM: NotebookLMService;

    constructor() {
        this.supabase = createServiceClient();
        this.geminiVideo = new GeminiVideoService();
        this.geminiDocument = new GeminiDocumentService();
        this.claudeLesson = new ClaudeLessonService();
        this.notebookLM = new NotebookLMService();
    }

    /**
     * Full pipeline: source → analysis → lesson generation → database save.
     */
    async processSourceToLesson(
        sourceUrl: string,
        sourceType: 'youtube' | 'pdf' | 'pptx',
        organizationId: string,
        onStatus?: StatusCallback,
        fileBuffer?: Buffer,
        fileName?: string
    ): Promise<{ courseId: string; lesson: GeneratedLesson }> {
        // Step 1: Create source record
        onStatus?.('Creating source record...');
        const source = await this.createSource(sourceUrl, sourceType, organizationId);

        try {
            // Step 2: Update status to processing
            await this.updateSourceStatus(source.id, 'processing');

            // Step 3: Analyze content
            onStatus?.('Analyzing content with Gemini AI...');
            const analysis = await this.analyzeSource(source.id, sourceUrl, sourceType, fileBuffer, fileName);

            // Step 4: Save analysis
            onStatus?.('Saving analysis results...');
            await this.saveAnalysis(source.id, analysis);

            // Step 5: Generate lesson 
            onStatus?.('Generating IATA-compliant lesson plan with Claude...');
            const title = await this.getSourceTitle(source.id);
            const lesson = await this.claudeLesson.generateLesson(
                analysis.analysisData,
                title
            );

            // Step 6: Save to database
            onStatus?.('Saving lesson plan...');
            const courseId = await this.saveLesson(lesson, source.id, organizationId);

            // Step 7: Create NotebookLM notebook
            onStatus?.('Preparing NotebookLM notebook...');
            try {
                await this.notebookLM.createNotebookForCourse(
                    { id: courseId, title: lesson.course.title, description: lesson.course.description },
                    analysis,
                    sourceUrl,
                    sourceType
                );
            } catch (nbError) {
                // Non-fatal — log and continue
                console.error('[Pipeline] NotebookLM creation failed (non-fatal):', nbError);
            }

            // Step 8: Mark complete
            await this.updateSourceStatus(source.id, 'completed');
            onStatus?.('Complete!');

            return { courseId, lesson };
        } catch (error) {
            await this.updateSourceStatus(source.id, 'failed');
            throw error;
        }
    }

    private async createSource(
        sourceUrl: string,
        sourceType: 'youtube' | 'pdf' | 'pptx',
        organizationId: string
    ) {
        let title = sourceUrl;

        if (sourceType === 'youtube') {
            try {
                const metadata = await YouTubeService.getMetadata(sourceUrl);
                title = metadata.title;
            } catch {
                // Fallback to URL
            }
        }

        const { data, error } = await this.supabase
            .from('sources')
            .insert({
                organization_id: organizationId,
                source_type: sourceType,
                source_url: sourceUrl,
                title,
                status: 'pending',
            })
            .select()
            .single();

        if (error) throw new Error(`Failed to create source: ${error.message}`);
        return data;
    }

    private async analyzeSource(
        sourceId: string,
        sourceUrl: string,
        sourceType: 'youtube' | 'pdf' | 'pptx',
        fileBuffer?: Buffer,
        fileName?: string
    ): Promise<SourceAnalysis> {
        if (sourceType === 'youtube') {
            const videoUrl = YouTubeService.getVideoUrl(sourceUrl);
            return this.geminiVideo.analyzeVideo(videoUrl, sourceId);
        }

        if (!fileBuffer || !fileName) {
            throw new Error('File buffer and name are required for document analysis');
        }

        const mimeType =
            sourceType === 'pdf'
                ? 'application/pdf'
                : 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

        return this.geminiDocument.analyzeDocument(fileBuffer, fileName, mimeType, sourceId);
    }

    private async saveAnalysis(sourceId: string, analysis: SourceAnalysis): Promise<void> {
        const { error } = await this.supabase.from('source_analyses').insert({
            source_id: sourceId,
            analysis_type: 'gemini_analysis',
            analysis_data: analysis.analysisData,
            processing_time: analysis.processingTime,
            cost: analysis.cost,
            model_used: analysis.modelUsed,
        });

        if (error) throw new Error(`Failed to save analysis: ${error.message}`);
    }

    private async saveLesson(
        lesson: GeneratedLesson,
        sourceId: string,
        organizationId: string
    ): Promise<string> {
        // Create course
        const { data: course, error: courseError } = await this.supabase
            .from('courses')
            .insert({
                organization_id: organizationId,
                title: lesson.course.title,
                description: lesson.course.description,
                status: 'draft',
            })
            .select()
            .single();

        if (courseError) throw new Error(`Failed to create course: ${courseError.message}`);

        // Create modules, objectives, and activities
        for (const mod of lesson.modules) {
            const { data: module, error: modError } = await this.supabase
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

            // Create source ↔ module mapping
            await this.supabase.from('lesson_source_mappings').insert({
                source_id: sourceId,
                module_id: module.id,
            });

            // Create objectives and their activities
            for (let i = 0; i < mod.objectives.length; i++) {
                const obj = mod.objectives[i];

                const { data: objective, error: objError } = await this.supabase
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

                // Create activities for this objective
                for (let j = 0; j < obj.activities.length; j++) {
                    const act = obj.activities[j];

                    const { error: actError } = await this.supabase
                        .from('learning_activities')
                        .insert({
                            learning_objective_id: objective.id,
                            instruction_method: act.instructionMethod,
                            description: act.description,
                            duration: act.duration,
                            resources: act.resources,
                            order_index: j,
                        });

                    if (actError) throw new Error(`Failed to create activity: ${actError.message}`);
                }
            }
        }

        return course.id;
    }

    private async updateSourceStatus(sourceId: string, status: string): Promise<void> {
        await this.supabase
            .from('sources')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', sourceId);
    }

    private async getSourceTitle(sourceId: string): Promise<string> {
        const { data } = await this.supabase
            .from('sources')
            .select('title')
            .eq('id', sourceId)
            .single();
        return data?.title || 'Untitled Source';
    }
}
