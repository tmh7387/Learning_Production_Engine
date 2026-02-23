import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '@/lib/config';
import { GeminiVideoAnalysis, SourceAnalysis } from '@/types/analysis';

export class GeminiVideoService {
    private genAI: GoogleGenerativeAI;
    private model;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: config.gemini.model });
    }

    /**
     * Analyzes a YouTube video using Gemini based on its transcript text.
     * The transcript is fetched separately and passed here for analysis.
     */
    async analyzeVideo(videoUrl: string, sourceId: string, transcriptText?: string): Promise<SourceAnalysis> {
        const startTime = Date.now();

        const prompt = `You are an expert instructional designer analyzing video content for lesson plan creation.

Analyze the following YouTube video transcript and provide a structured analysis in JSON format:

{
  "summary": "Comprehensive summary of the video content (2-3 paragraphs)",
  "mainTopics": ["List of main topics covered"],
  "keyConceptsAndDefinitions": [
    {"concept": "Name", "definition": "Clear definition"}
  ],
  "teachingOpportunities": [
    {
      "topic": "Topic name",
      "suggestedApproach": "How to teach this",
      "bloomsLevel": "One of: remember, understand, apply, analyze, evaluate, create"
    }
  ],
  "transcript": "Key dialogue and narration from the video",
  "visualElements": ["Notable visual elements, diagrams, demonstrations mentioned in transcript"],
  "estimatedDifficultyLevel": "beginner/intermediate/advanced",
  "prerequisites": ["What learners should already know"],
  "suggestedDuration": "Estimated teaching time for this content"
}

Focus on educational value and how this content can be transformed into structured learning activities compliant with IATA training standards. Respond ONLY with valid JSON.`;

        try {
            const contentParts = [
                { text: prompt },
                { text: `YouTube Video URL: ${videoUrl}` },
            ];

            if (transcriptText) {
                contentParts.push({ text: `\n\nVideo Transcript:\n${transcriptText}` });
            }

            const result = await this.model.generateContent(contentParts);

            const response = result.response;
            const text = response.text();

            // Parse JSON from response (strip markdown code blocks if present)
            const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const analysisData: GeminiVideoAnalysis = JSON.parse(jsonStr);

            const processingTime = Date.now() - startTime;

            return {
                sourceId,
                analysisData,
                processingTime,
                cost: this.estimateCost(text.length),
                modelUsed: config.gemini.model,
            };
        } catch (error) {
            throw new Error(
                `Video analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Generates text embeddings for vector search.
     */
    async generateEmbedding(text: string): Promise<number[]> {
        const embeddingModel = this.genAI.getGenerativeModel({
            model: config.gemini.embeddingModel,
        });

        const result = await embeddingModel.embedContent(text);
        return result.embedding.values;
    }

    private estimateCost(outputLength: number): number {
        // Rough cost estimate based on Gemini 1.5 Pro pricing
        const inputTokenEstimate = 1000;
        const outputTokenEstimate = outputLength / 4;
        const inputCostPer1M = 3.5;
        const outputCostPer1M = 10.5;
        return (
            (inputTokenEstimate / 1_000_000) * inputCostPer1M +
            (outputTokenEstimate / 1_000_000) * outputCostPer1M
        );
    }
}
