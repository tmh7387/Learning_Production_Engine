import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GeminiVideoAnalysis, Source, SourceAnalysis } from '@/types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface AnalyzeVideoOptions {
    model?: string;
    maxDuration?: number;
}

export class GeminiVideoService {
    private model;

    constructor() {
        this.model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    }

    /**
     * Analyze a YouTube video using Gemini's native video understanding
     * @param videoUrl - YouTube video URL or local file path
     * @param sourceId - Database source ID for tracking
     * @returns Structured analysis of the video
     */
    async analyzeVideo(
        videoUrl: string,
        sourceId: string,
        options?: AnalyzeVideoOptions
    ): Promise<SourceAnalysis> {
        const startTime = Date.now();

        try {
            // 1. Upload video to Gemini Files API
            const videoFile = await this.uploadVideoFile(videoUrl);

            // 2. Wait for processing
            await this.waitForFileProcessing(videoFile.name);

            // 3. Generate comprehensive analysis
            const analysis = await this.generateAnalysis(videoFile);

            // 4. Calculate cost (Gemini 1.5 Pro pricing)
            const processingTime = Date.now() - startTime;
            const cost = this.calculateCost(videoFile.sizeBytes, analysis);

            return {
                id: crypto.randomUUID(),
                source_id: sourceId,
                analysis_type: 'gemini_video',
                analysis_data: analysis,
                processing_time_ms: processingTime,
                cost_usd: cost,
                model_used: 'gemini-1.5-pro',
                created_at: new Date().toISOString(),
            };
        } catch (error) {
            console.error('Gemini video analysis error:', error);
            throw new Error(`Video analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Upload video file to Gemini Files API
     */
    private async uploadVideoFile(videoUrl: string) {
        // For YouTube URLs, we'll download first (handled by YouTube service)
        // For now, assume we have a local file path
        const fileManager = genAI.fileManager;

        const uploadResult = await fileManager.uploadFile(videoUrl, {
            mimeType: 'video/mp4',
            displayName: `training-video-${Date.now()}`,
        });

        return uploadResult.file;
    }

    /**
     * Wait for Gemini to process the uploaded file
     */
    private async waitForFileProcessing(fileName: string, maxWaitTime = 300000) {
        const fileManager = genAI.fileManager;
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            const file = await fileManager.getFile(fileName);

            if (file.state === 'ACTIVE') {
                return file;
            }

            if (file.state === 'FAILED') {
                throw new Error('File processing failed');
            }

            // Wait 5 seconds before checking again
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        throw new Error('File processing timeout');
    }

    /**
     * Generate structured analysis using Gemini
     */
    private async generateAnalysis(videoFile: any): Promise<GeminiVideoAnalysis> {
        const prompt = this.buildAnalysisPrompt();

        const result = await this.model.generateContent([
            {
                fileData: {
                    mimeType: videoFile.mimeType,
                    fileUri: videoFile.uri,
                },
            },
            { text: prompt },
        ]);

        const response = result.response;
        const text = response.text();

        // Parse JSON from response (Gemini should return JSON)
        const analysis = this.parseAnalysisResponse(text);

        return analysis;
    }

    /**
     * Build comprehensive analysis prompt
     */
    private buildAnalysisPrompt(): string {
        return `You are an expert instructional designer analyzing educational content.
    
Analyze this video comprehensively and return a JSON object with the following structure:

{
  "summary": "Brief 2-3 sentence overview of the video's educational content",
  "keyTopics": [
    {
      "name": "Topic name",
      "description": "What is taught about this topic",
      "timeRange": { "start": 0, "end": 120 },
      "importance": "high" | "medium" | "low",
      "keywords": ["keyword1", "keyword2"]
    }
  ],
  "transcript": "Full transcript of the video",
  "structuralElements": [
    {
      "type": "introduction" | "main_content" | "example" | "summary" | "assessment",
      "timestamp": 0,
      "description": "What happens in this section"
    }
  ],
  "teachingOpportunities": [
    {
      "timestamp": 0,
      "type": "concept" | "procedure" | "example" | "assessment_point",
      "description": "What could be taught here",
      "suggestedActivity": "Specific learning activity suggestion"
    }
  ],
  "visualElements": [
    {
      "timestamp": 0,
      "type": "diagram" | "code" | "ui" | "chart",
      "description": "What is shown visually"
    }
  ]
}

CRITICAL REQUIREMENTS:
1. Extract complete, accurate transcript
2. Identify all timestamps for key moments
3. Focus on instructional design opportunities
4. Note any code examples, diagrams, or demonstrations
5. Suggest specific, actionable learning activities
6. Identify assessment opportunities

Return ONLY valid JSON, no markdown formatting.`;
    }

    /**
     * Parse analysis response from Gemini
     */
    private parseAnalysisResponse(responseText: string): GeminiVideoAnalysis {
        // Remove markdown code blocks if present
        let jsonText = responseText.trim();

        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
        }

        try {
            const parsed = JSON.parse(jsonText);
            return parsed as GeminiVideoAnalysis;
        } catch (error) {
            console.error('Failed to parse Gemini response:', responseText);
            throw new Error('Invalid JSON response from Gemini');
        }
    }

    /**
     * Calculate cost based on Gemini 1.5 Pro pricing
     * Video input: ~$0.0001875/second
     * Text output: ~$0.0000075/character
     */
    private calculateCost(videoSizeBytes: number, analysis: GeminiVideoAnalysis): number {
        // Rough estimation - improve with actual metrics
        const videoDurationSeconds = Math.ceil(videoSizeBytes / (1024 * 1024 * 2)); // Rough estimate
        const outputChars = JSON.stringify(analysis).length;

        const videoCost = videoDurationSeconds * 0.0001875;
        const outputCost = outputChars * 0.0000075;

        return Number((videoCost + outputCost).toFixed(6));
    }

    /**
     * Generate embeddings for knowledge chunks (Gemini Embedding API)
     */
    async generateEmbedding(text: string): Promise<number[]> {
        const embeddingModel = genAI.getGenerativeModel({ model: 'embedding-001' });

        const result = await embeddingModel.embedContent(text);

        return result.embedding.values;
    }
}

export const geminiVideoService = new GeminiVideoService();