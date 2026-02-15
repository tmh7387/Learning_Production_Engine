export interface GeminiVideoAnalysis {
    summary: string;
    keyTopics: Array<{
        name: string;
        description: string;
        timeRange: { start: number; end: number };
        importance: 'high' | 'medium' | 'low';
        keywords: string[];
    }>;
    transcript: string;
    structuralElements: Array<{
        type: 'introduction' | 'main_content' | 'example' | 'summary' | 'assessment';
        timestamp: number;
        description: string;
    }>;
    teachingOpportunities: Array<{
        timestamp: number;
        type: 'concept' | 'procedure' | 'example' | 'assessment_point';
        description: string;
        suggestedActivity: string;
    }>;
    visualElements?: Array<{
        timestamp: number;
        type: 'diagram' | 'code' | 'ui' | 'chart';
        description: string;
    }>;
}

export interface SourceAnalysis {
    id: string;
    source_id: string;
    analysis_type: 'gemini_video' | 'gemini_document' | 'gemini_general';
    analysis_data: GeminiVideoAnalysis | Record<string, any>;
    processing_time_ms: number;
    cost_usd: number;
    model_used: string;
    created_at: string;
}