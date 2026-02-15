import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import type { SourceAnalysis } from '@/types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export class GeminiDocumentService {
    private model;

    constructor() {
        this.model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    }

    /**
     * Analyze PDF document
     */
    async analyzePDF(
        filePath: string,
        sourceId: string
    ): Promise<SourceAnalysis> {
        const startTime = Date.now();

        try {
            // 1. Extract text from PDF
            const pdfBuffer = fs.readFileSync(filePath);
            const pdfData = await pdfParse(pdfBuffer);
            const text = pdfData.text;

            // 2. Upload PDF to Gemini for visual analysis
            const fileManager = genAI.fileManager;
            const uploadResult = await fileManager.uploadFile(filePath, {
                mimeType: 'application/pdf',
                displayName: `training-doc-${Date.now()}`,
            });

            // 3. Wait for processing
            await this.waitForFileProcessing(uploadResult.file.name);

            // 4. Analyze with both text and visual understanding
            const analysis = await this.generateDocumentAnalysis(uploadResult.file, text);

            const processingTime = Date.now() - startTime;
            const cost = this.calculateCost(text.length, analysis);

            return {
                id: crypto.randomUUID(),
                source_id: sourceId,
                analysis_type: 'gemini_document',
                analysis_data: analysis,
                processing_time_ms: processingTime,
                cost_usd: cost,
                model_used: 'gemini-1.5-pro',
                created_at: new Date().toISOString(),
            };
        } catch (error) {
            console.error('PDF analysis error:', error);
            throw new Error(`PDF analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Analyze PowerPoint document
     */
    async analyzePPTX(
        filePath: string,
        sourceId: string
    ): Promise<SourceAnalysis> {
        const startTime = Date.now();

        try {
            // 1. Extract text from PPTX (if possible)
            // Note: Basic text extraction - Gemini will handle visual analysis
            let extractedText = '';
            // For PPTX, we rely more on Gemini's visual understanding

            // 2. Upload to Gemini
            const fileManager = genAI.fileManager;
            const uploadResult = await fileManager.uploadFile(filePath, {
                mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                displayName: `training-pptx-${Date.now()}`,
            });

            // 3. Wait for processing
            await this.waitForFileProcessing(uploadResult.file.name);

            // 4. Analyze
            const analysis = await this.generatePPTXAnalysis(uploadResult.file);

            const processingTime = Date.now() - startTime;
            const cost = this.calculateCost(5000, analysis); // Estimate for PPTX

            return {
                id: crypto.randomUUID(),
                source_id: sourceId,
                analysis_type: 'gemini_document',
                analysis_data: analysis,
                processing_time_ms: processingTime,
                cost_usd: cost,
                model_used: 'gemini-1.5-pro',
                created_at: new Date().toISOString(),
            };
        } catch (error) {
            console.error('PPTX analysis error:', error);
            throw new Error(`PPTX analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async waitForFileProcessing(fileName: string, maxWaitTime = 300000) {
        const fileManager = genAI.fileManager;
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            const file = await fileManager.getFile(fileName);

            if (file.state === 'ACTIVE') return file;
            if (file.state === 'FAILED') throw new Error('File processing failed');

            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        throw new Error('File processing timeout');
    }

    private async generateDocumentAnalysis(file: any, extractedText: string) {
        const prompt = `Analyze this training document comprehensively.

Extracted text:
${extractedText}

Return JSON with this structure:
{
  "summary": "Overview of the document's training content",
  "keyTopics": [
    {
      "name": "Topic name",
      "description": "What is taught",
      "pageNumbers": [1, 2, 3],
      "importance": "high" | "medium" | "low",
      "keywords": ["keyword1", "keyword2"]
    }
  ],
  "structuralElements": [
    {
      "type": "introduction" | "main_content" | "example" | "summary" | "assessment",
      "pageNumber": 1,
      "description": "What this section covers"
    }
  ],
  "visualElements": [
    {
      "pageNumber": 1,
      "type": "diagram" | "chart" | "table" | "image",
      "description": "What is shown"
    }
  ],
  "teachingOpportunities": [
    {
      "pageNumber": 1,
      "type": "concept" | "procedure" | "example" | "assessment_point",
      "description": "What could be taught",
      "suggestedActivity": "Specific activity"
    }
  ]
}

Return ONLY valid JSON.`;

        const result = await this.model.generateContent([
            {
                fileData: {
                    mimeType: file.mimeType,
                    fileUri: file.uri,
                },
            },
            { text: prompt },
        ]);

        const text = result.response.text();
        return this.parseJSON(text);
    }

    private async generatePPTXAnalysis(file: any) {
        const prompt = `Analyze this PowerPoint presentation for training content.

Focus on:
1. Slide-by-slide content analysis
2. Visual elements (diagrams, charts, images)
3. Learning progression through slides
4. Key concepts and procedures taught

Return JSON with this structure:
{
  "summary": "Overview of presentation content",
  "slideCount": 0,
  "keyTopics": [
    {
      "name": "Topic",
      "description": "Content",
      "slideNumbers": [1, 2],
      "importance": "high",
      "keywords": []
    }
  ],
  "slides": [
    {
      "slideNumber": 1,
      "title": "Slide title",
      "content": "Main content",
      "visualElements": [
        {
          "type": "diagram" | "chart" | "image" | "code",
          "description": "What is shown"
        }
      ],
      "teachingPoint": "What this slide teaches"
    }
  ],
  "teachingOpportunities": [
    {
      "slideNumber": 1,
      "type": "concept" | "procedure" | "example",
      "description": "Teaching opportunity",
      "suggestedActivity": "Activity suggestion"
    }
  ]
}

Return ONLY valid JSON.`;

        const result = await this.model.generateContent([
            {
                fileData: {
                    mimeType: file.mimeType,
                    fileUri: file.uri,
                },
            },
            { text: prompt },
        ]);

        const text = result.response.text();
        return this.parseJSON(text);
    }

    private parseJSON(text: string): any {
        let jsonText = text.trim();

        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
        }

        try {
            return JSON.parse(jsonText);
        } catch (error) {
            console.error('Failed to parse JSON:', text);
            throw new Error('Invalid JSON response');
        }
    }

    private calculateCost(inputChars: number, analysis: any): number {
        const outputChars = JSON.stringify(analysis).length;

        // Gemini 1.5 Pro: ~$0.00000125/char input, ~$0.0000075/char output
        const inputCost = inputChars * 0.00000125;
        const outputCost = outputChars * 0.0000075;

        return Number((inputCost + outputCost).toFixed(6));
    }
}

export const geminiDocumentService = new GeminiDocumentService();