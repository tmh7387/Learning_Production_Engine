import { createServiceClient } from '@/lib/supabase/server';
import { OpenRouterService } from '@/services/ai/openrouterService';
import { NotebookLMService } from '@/services/notebooklm/notebookService';
import { YouTubeService } from '@/services/sources/youtube';
import { GeneratedLesson } from '@/types/lessons';
import { SourceAnalysis } from '@/types/analysis';

type StatusCallback = (status: string) => void;

export class PipelineOrchestrator {
    private supabase;
    private ai: OpenRouterService;
    private notebookLM: NotebookLMService;

    constructor() {
        this.supabase = createServiceClient();
        this.ai = new OpenRouterService();
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
        console.log('[Pipeline] ====== STARTING PIPELINE ======');
        console.log('[Pipeline] sourceUrl:', sourceUrl);
        console.log('[Pipeline] sourceType:', sourceType);
        console.log('[Pipeline] organizationId:', organizationId);

        // Step 1: Create source record
        console.log('[Pipeline] Step 1: Creating source record...');
        onStatus?.('Creating source record...');
        const source = await this.createSource(sourceUrl, sourceType, organizationId);
        console.log('[Pipeline] Step 1 DONE — source.id:', source.id);

        try {
            // Step 2: Update status to processing
            console.log('[Pipeline] Step 2: Updating status to processing...');
            await this.updateSourceStatus(source.id, 'processing');
            console.log('[Pipeline] Step 2 DONE');

            // Step 3: Analyze content
            console.log('[Pipeline] Step 3: Analyzing content...');
            onStatus?.('Analyzing content with Gemini AI...');
            const analysis = await this.analyzeSource(source.id, sourceUrl, sourceType, fileBuffer, fileName);
            console.log('[Pipeline] Step 3 DONE — analysis keys:', Object.keys(analysis));

            // Step 4: Save analysis
            console.log('[Pipeline] Step 4: Saving analysis...');
            onStatus?.('Saving analysis results...');
            await this.saveAnalysis(source.id, analysis);
            console.log('[Pipeline] Step 4 DONE');

            // Step 5: Generate lesson 
            console.log('[Pipeline] Step 5: Generating lesson with OpenRouter...');
            onStatus?.('Generating IATA-compliant lesson plan with OpenRouter...');
            const title = await this.getSourceTitle(source.id);
            console.log('[Pipeline] Step 5a: Got title:', title);
            const lesson = await this.ai.generateLesson(
                analysis.analysisData,
                title
            );
            console.log('[Pipeline] Step 5 DONE — lesson.course.title:', lesson?.course?.title);

            // Step 6: Save to database
            console.log('[Pipeline] Step 6: Saving lesson to DB...');
            onStatus?.('Saving lesson plan...');
            const courseId = await this.saveLesson(lesson, source.id, organizationId);
            console.log('[Pipeline] Step 6 DONE — courseId:', courseId);

            // Step 7: Create NotebookLM notebook
            console.log('[Pipeline] Step 7: Creating NotebookLM notebook...');
            onStatus?.('Preparing NotebookLM notebook...');
            try {
                await this.notebookLM.createNotebookForCourse(
                    { id: courseId, title: lesson.course.title, description: lesson.course.description },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    analysis as any,
                    sourceUrl,
                    sourceType
                );
                console.log('[Pipeline] Step 7 DONE');
            } catch (nbError) {
                // Non-fatal — log and continue
                console.error('[Pipeline] NotebookLM creation failed (non-fatal):', nbError);
            }

            // Step 8: Mark complete
            console.log('[Pipeline] Step 8: Marking complete...');
            await this.updateSourceStatus(source.id, 'completed');
            onStatus?.('Complete!');
            console.log('[Pipeline] ====== PIPELINE COMPLETE ======');

            return { courseId, lesson };
        } catch (error) {
            console.error('[Pipeline] ====== PIPELINE FAILED ======');
            console.error('[Pipeline] Error:', error);
            console.error('[Pipeline] Error message:', error instanceof Error ? error.message : JSON.stringify(error));
            console.error('[Pipeline] Error stack:', error instanceof Error ? error.stack : 'N/A');
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
                console.log('[Pipeline] Got YouTube title:', title);
            } catch (ytErr) {
                console.warn('[Pipeline] YouTube metadata fetch failed, using URL as title:', ytErr);
            }
        }

        const insertPayload = {
            organization_id: organizationId,
            source_type: sourceType,
            source_url: sourceUrl,
            title,
            status: 'pending',
        };
        console.log('[Pipeline] Inserting source with payload:', JSON.stringify(insertPayload));

        const { data, error } = await this.supabase
            .from('sources')
            .insert(insertPayload)
            .select()
            .single();

        if (error) {
            console.error('[Pipeline] createSource DB error:', JSON.stringify(error));
            throw new Error(`Failed to create source: ${error.message}`);
        }
        console.log('[Pipeline] createSource success, id:', data.id);
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
            // We'll need to fetch the transcript if we want high-quality analysis
            // For now, let's pass a placeholder or implement transcript fetching if possible
            return this.ai.analyzeVideo(videoUrl, sourceId);
        }

        if (!fileBuffer || !fileName) {
            throw new Error('File buffer and name are required for document analysis');
        }

        const mimeType =
            sourceType === 'pdf'
                ? 'application/pdf'
                : 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

        return this.ai.analyzeDocument(fileBuffer, fileName, mimeType, sourceId);
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
