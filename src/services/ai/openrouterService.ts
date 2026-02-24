import { config } from '@/lib/config';
import { GeminiVideoAnalysis, SourceAnalysis } from '@/types/analysis';
import { GeneratedLesson } from '@/types/lessons';

export class OpenRouterService {
    private apiKey: string;
    private baseUrl = 'https://openrouter.ai/api/v1';

    constructor() {
        this.apiKey = process.env.OPENROUTER_API_KEY || '';
        if (!this.apiKey) {
            console.warn('[OpenRouterService] OPENROUTER_API_KEY is not set. Requests will fail.');
        }
    }

    private async request(path: string, body: any) {
        if (!this.apiKey) throw new Error('OPENROUTER_API_KEY is not set');

        const response = await fetch(`${this.baseUrl}${path}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Origin': 'http://localhost:3000',
                'X-Title': 'Learning Production Engine',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`OpenRouter error: ${JSON.stringify(error)}`);
        }

        return response.json();
    }

    async analyzeVideo(videoUrl: string, sourceId: string, transcriptText?: string): Promise<SourceAnalysis> {
        const startTime = Date.now();
        const prompt = this.getAnalysisPrompt();

        const content = [
            { type: 'text', text: prompt },
            { type: 'text', text: `YouTube Video URL: ${videoUrl}` },
        ];

        if (transcriptText) {
            content.push({ type: 'text', text: `\n\nVideo Transcript:\n${transcriptText}` });
        }

        const data = await this.request('/chat/completions', {
            model: config.ai.analysisModel,
            messages: [{ role: 'user', content }],
            response_format: { type: 'json_object' }
        });

        const analysisData: GeminiVideoAnalysis = JSON.parse(data.choices[0].message.content);
        const processingTime = Date.now() - startTime;

        return {
            sourceId,
            analysisData,
            processingTime,
            cost: 0, // OpenRouter handles billing
            modelUsed: config.ai.analysisModel,
        };
    }

    async analyzeDocument(fileBuffer: Buffer, fileName: string, mimeType: string, sourceId: string): Promise<SourceAnalysis> {
        const startTime = Date.now();
        const prompt = this.getAnalysisPrompt();
        const base64Data = fileBuffer.toString('base64');

        const data = await this.request('/chat/completions', {
            model: config.ai.analysisModel,
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        {
                            type: 'file',
                            data: {
                                mime_type: mimeType,
                                data: base64Data
                            }
                        }
                    ]
                }
            ],
            response_format: { type: 'json_object' }
        });

        const analysisData: GeminiVideoAnalysis = JSON.parse(data.choices[0].message.content);
        const processingTime = Date.now() - startTime;

        return {
            sourceId,
            analysisData,
            processingTime,
            cost: 0,
            modelUsed: config.ai.analysisModel,
        };
    }

    async generateLesson(analysis: GeminiVideoAnalysis, sourceTitle: string): Promise<GeneratedLesson> {
        const prompt = this.getLessonPrompt(sourceTitle, analysis);

        const data = await this.request('/chat/completions', {
            model: config.ai.lessonModel,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: config.ai.maxTokens,
            response_format: { type: 'json_object' }
        });

        const lesson: GeneratedLesson = JSON.parse(data.choices[0].message.content);
        return lesson;
    }

    private getAnalysisPrompt(): string {
        return `You are an expert instructional designer analyzing content for lesson plan creation.
Analyze the following content and provide a structured analysis in JSON format:

{
  "summary": "Comprehensive summary of the content (2-3 paragraphs)",
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
  "transcript": "Key dialogue and narration if applicable",
  "visualElements": ["Notable visual elements, diagrams, demonstrations"],
  "estimatedDifficultyLevel": "beginner/intermediate/advanced",
  "prerequisites": ["What learners should already know"],
  "suggestedDuration": "Estimated teaching time for this content"
}

Focus on educational value and how this content can be transformed into structured learning activities compliant with IATA training standards. Respond ONLY with valid JSON.`;
    }

    private getLessonPrompt(sourceTitle: string, analysis: GeminiVideoAnalysis): string {
        return `You are an expert aviation instructional designer specializing in IATA training standards.
Given the following content analysis, create a comprehensive, IATA-compliant lesson plan.

## Source Content Analysis
Title: ${sourceTitle}
Summary: ${analysis.summary}
Main Topics: ${analysis.mainTopics.join(', ')}
Key Concepts: ${JSON.stringify(analysis.keyConceptsAndDefinitions)}
Teaching Opportunities: ${JSON.stringify(analysis.teachingOpportunities)}
Difficulty: ${analysis.estimatedDifficultyLevel}
Prerequisites: ${analysis.prerequisites.join(', ')}

## Requirements
1. Follow IATA Training Standards (AHM Chapter 12 / IGOM Chapter 2)
2. Use Bloom's Taxonomy for learning objectives (remember → create)
3. Each terminal objective must have at least one enabling objective
4. Activities must include instruction method, description, duration, and resources
5. Respond with ONLY valid JSON matching the system structure.`;
    }
}
