import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import { config } from '@/lib/config';
import { GeminiVideoAnalysis, SourceAnalysis } from '@/types/analysis';
import fs from 'fs';
import path from 'path';
import os from 'os';

export class GeminiDocumentService {
    private genAI: GoogleGenerativeAI;
    private fileManager: GoogleAIFileManager;
    private model;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

        this.genAI = new GoogleGenerativeAI(apiKey);
        this.fileManager = new GoogleAIFileManager(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: config.gemini.model });
    }

    /**
     * Analyzes a PDF or PPTX document by uploading to Gemini Files API.
     */
    async analyzeDocument(
        fileBuffer: Buffer,
        fileName: string,
        mimeType: string,
        sourceId: string
    ): Promise<SourceAnalysis> {
        const startTime = Date.now();

        // Write buffer to temp file for upload
        const tempDir = os.tmpdir();
        const tempPath = path.join(tempDir, `lpe-${Date.now()}-${fileName}`);
        fs.writeFileSync(tempPath, fileBuffer);

        try {
            // Upload to Gemini Files API
            const uploadResult = await this.fileManager.uploadFile(tempPath, {
                mimeType,
                displayName: fileName,
            });

            // Wait for processing
            let file = uploadResult.file;
            while (file.state === FileState.PROCESSING) {
                await new Promise((resolve) => setTimeout(resolve, 3000));
                file = await this.fileManager.getFile(file.name);
            }

            if (file.state === FileState.FAILED) {
                throw new Error('Document processing failed in Gemini');
            }

            // Analyze the document
            const prompt = `You are an expert instructional designer analyzing a document for lesson plan creation.

Analyze this document and provide a structured analysis in JSON format:

{
  "summary": "Comprehensive summary of the document content (2-3 paragraphs)",
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
  "transcript": "Key text content extracted from the document",
  "visualElements": ["Notable diagrams, charts, images, and their descriptions"],
  "estimatedDifficultyLevel": "beginner/intermediate/advanced",
  "prerequisites": ["What learners should already know"],
  "suggestedDuration": "Estimated teaching time for this content"
}

Focus on educational value and IATA training standards compliance. Respond ONLY with valid JSON.`;

            const result = await this.model.generateContent([
                {
                    fileData: {
                        mimeType: file.mimeType,
                        fileUri: file.uri,
                    },
                },
                { text: prompt },
            ]);

            const response = result.response;
            const text = response.text();

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
        } finally {
            // Clean up temp file
            try {
                fs.unlinkSync(tempPath);
            } catch {
                // Ignore cleanup errors
            }
        }
    }

    private estimateCost(outputLength: number): number {
        const inputTokenEstimate = 2000;
        const outputTokenEstimate = outputLength / 4;
        const inputCostPer1M = 3.5;
        const outputCostPer1M = 10.5;
        return (
            (inputTokenEstimate / 1_000_000) * inputCostPer1M +
            (outputTokenEstimate / 1_000_000) * outputCostPer1M
        );
    }
}
