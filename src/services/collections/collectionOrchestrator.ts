import { createServiceClient } from '@/lib/supabase/server';
import { GeminiVideoService } from '@/services/gemini/videoAnalysis';
import { GeminiDocumentService } from '@/services/gemini/documentAnalysis';
import { TranscriptService } from '@/services/sources/transcriptService';
import { YouTubeService } from '@/services/sources/youtube';
import { CollectionAnalyzer } from './collectionAnalyzer';
import { CollectionLessonService } from './collectionLessonService';
import type { GeneratedLesson } from '@/types/lessons';

export class CollectionOrchestrator {
    private supabase;
    private geminiVideo: GeminiVideoService;
    private geminiDocument: GeminiDocumentService;
    private transcript: TranscriptService;
    private analyzer: CollectionAnalyzer;
    private lessonService: CollectionLessonService;

    constructor() {
        this.supabase = createServiceClient();
        this.geminiVideo = new GeminiVideoService();
        this.geminiDocument = new GeminiDocumentService();
        this.transcript = new TranscriptService();
        this.analyzer = new CollectionAnalyzer();
        this.lessonService = new CollectionLessonService();
    }

    /**
     * Full pipeline: Collection → Analysis → Lesson Generation
     */
    async processCollectionToLesson(
        collectionId: string,
        organizationId: string
    ): Promise<{ courseId: string; lesson: GeneratedLesson }> {
        try {
            // 1. Analyze collection (if not already done)
            const analysis = await this.ensureCollectionAnalysis(collectionId);

            // 2. Generate lesson from collection synthesis
            const lesson = await this.lessonService.generateFromCollection(
                collectionId,
                analysis.analysis_data
            );

            // 3. Save to database
            const courseId = await this.saveLesson(lesson, collectionId, organizationId);

            return { courseId, lesson };
        } catch (error) {
            console.error('Collection orchestration error:', error);
            throw error;
        }
    }

    /**
     * Add a source to a collection and analyze it
     */
    async addSourceToCollection(
        collectionId: string,
        sourceUrl: string,
        sourceType: 'youtube' | 'pdf' | 'pptx',
        fileBuffer?: Buffer,
        fileName?: string
    ): Promise<string> {
        try {
            // 1. Create source record
            console.log('[CollectionOrchestrator] Step 1: Getting org ID for collection', collectionId);
            const orgId = await this.getCollectionOrgId(collectionId);
            console.log('[CollectionOrchestrator] Org ID:', orgId);

            // Determine title based on source type
            let title = fileName || sourceUrl;
            if (sourceType === 'youtube') {
                try {
                    const metadata = await YouTubeService.getMetadata(sourceUrl);
                    title = metadata.title;
                    console.log('[CollectionOrchestrator] YouTube title:', title);
                } catch {
                    console.warn('[CollectionOrchestrator] Could not fetch YouTube metadata, using URL as title');
                }
            }

            console.log('[CollectionOrchestrator] Step 2: Creating source record...');
            const { data: source, error: sourceError } = await this.supabase
                .from('sources')
                .insert({
                    organization_id: orgId,
                    source_type: sourceType,
                    source_url: sourceUrl,
                    title,
                    status: 'processing',
                })
                .select()
                .single();

            if (sourceError) {
                console.error('[CollectionOrchestrator] Source insert error:', sourceError);
                throw sourceError;
            }
            console.log('[CollectionOrchestrator] Source created:', source.id);

            // 2. For YouTube: Get transcript first, then Gemini analysis with transcript context
            if (sourceType === 'youtube') {
                // Fetch transcript first
                console.log('[CollectionOrchestrator] Step 3: Fetching YouTube transcript...');
                const transcript = await this.transcript.fetchYouTubeTranscript(sourceUrl);
                console.log('[CollectionOrchestrator] Transcript fetched, segments:', transcript.length);
                const transcriptText = transcript.map(s => s.text).join(' ');

                // Run Gemini analysis with transcript context
                console.log('[CollectionOrchestrator] Step 4: Running Gemini video analysis...');
                const videoAnalysis = await this.geminiVideo.analyzeVideo(sourceUrl, source.id, transcriptText);
                console.log('[CollectionOrchestrator] Gemini analysis complete');

                // Update source with transcript
                await this.supabase
                    .from('sources')
                    .update({
                        transcript: transcript,
                        duration_seconds: Math.max(...transcript.map((t) => t.start + t.duration)),
                    })
                    .eq('id', source.id);

                // Save Gemini analysis
                const { error: analysisError } = await this.supabase.from('source_analyses').insert({
                    source_id: source.id,
                    analysis_type: 'gemini_video',
                    analysis_data: videoAnalysis.analysisData,
                    processing_time: videoAnalysis.processingTime,
                    cost: videoAnalysis.cost,
                    model_used: videoAnalysis.modelUsed,
                });
                if (analysisError) {
                    console.error('[CollectionOrchestrator] Analysis insert error:', analysisError);
                    throw analysisError;
                }
            }

            // 3. For PDF/PPTX: Gemini document analysis
            else if (fileBuffer && fileName) {
                console.log('[CollectionOrchestrator] Step 3: Analyzing document:', fileName);
                const mimeType =
                    sourceType === 'pdf'
                        ? 'application/pdf'
                        : 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

                const docAnalysis = await this.geminiDocument.analyzeDocument(
                    fileBuffer,
                    fileName,
                    mimeType,
                    source.id
                );
                console.log('[CollectionOrchestrator] Document analysis complete');

                const { error: docAnalysisError } = await this.supabase.from('source_analyses').insert({
                    source_id: source.id,
                    analysis_type: 'gemini_document',
                    analysis_data: docAnalysis.analysisData,
                    processing_time: docAnalysis.processingTime,
                    cost: docAnalysis.cost,
                    model_used: docAnalysis.modelUsed,
                });
                if (docAnalysisError) {
                    console.error('[CollectionOrchestrator] Doc analysis insert error:', docAnalysisError);
                    throw docAnalysisError;
                }
            } else {
                console.warn('[CollectionOrchestrator] No fileBuffer/fileName provided for', sourceType, '- skipping analysis');
            }

            // 4. Add to collection
            console.log('[CollectionOrchestrator] Step 5: Linking source to collection...');
            const maxOrder = await this.getMaxOrderIndex(collectionId);
            const { error: linkError } = await this.supabase.from('collection_sources').insert({
                collection_id: collectionId,
                source_id: source.id,
                order_index: maxOrder + 1,
            });
            if (linkError) {
                console.error('[CollectionOrchestrator] Link insert error:', linkError);
                throw linkError;
            }

            // 5. Mark source as completed
            await this.supabase
                .from('sources')
                .update({ status: 'completed' })
                .eq('id', source.id);

            // 6. Mark collection as needing re-analysis
            await this.supabase
                .from('source_collections')
                .update({ status: 'building' })
                .eq('id', collectionId);

            console.log('[CollectionOrchestrator] Source added successfully:', source.id);
            return source.id;
        } catch (error) {
            console.error('[CollectionOrchestrator] Add source error:', error);
            // Provide detailed error message
            const message = error instanceof Error ? error.message : JSON.stringify(error);
            throw new Error(`Failed to add source to collection: ${message}`);
        }
    }

    private async ensureCollectionAnalysis(collectionId: string) {
        // Check if analysis exists
        const { data: existing } = await this.supabase
            .from('collection_analyses')
            .select('*')
            .eq('collection_id', collectionId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (existing) return existing;

        // Run analysis
        return await this.analyzer.analyzeCollection(collectionId);
    }

    private async getCollectionOrgId(collectionId: string): Promise<string> {
        const { data } = await this.supabase
            .from('source_collections')
            .select('organization_id')
            .eq('id', collectionId)
            .single();

        return data?.organization_id;
    }

    private async getMaxOrderIndex(collectionId: string): Promise<number> {
        const { data } = await this.supabase
            .from('collection_sources')
            .select('order_index')
            .eq('collection_id', collectionId)
            .order('order_index', { ascending: false })
            .limit(1)
            .single();

        return data?.order_index ?? -1;
    }

    private async saveLesson(
        lesson: GeneratedLesson,
        collectionId: string,
        organizationId: string
    ): Promise<string> {
        // Create course
        const { data: course, error: courseError } = await this.supabase
            .from('courses')
            .insert({
                organization_id: organizationId,
                collection_id: collectionId,
                title: lesson.course.title,
                description: lesson.course.description,
                course_code: lesson.course.course_code,
                iata_category: lesson.course.iata_category,
                total_duration_minutes: lesson.course.total_duration_minutes,
                status: 'draft',
            })
            .select()
            .single();

        if (courseError) throw courseError;

        // Create modules, objectives, activities
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

            if (modError) throw modError;

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

                if (objError) throw objError;

                for (let j = 0; j < obj.activities.length; j++) {
                    const act = obj.activities[j];
                    await this.supabase.from('learning_activities').insert({
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

        return course.id;
    }
}

export const collectionOrchestrator = new CollectionOrchestrator();
