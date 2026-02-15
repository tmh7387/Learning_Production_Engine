export interface GeminiVideoAnalysis {
    summary: string;
    mainTopics: string[];
    keyConceptsAndDefinitions: Array<{
        concept: string;
        definition: string;
    }>;
    teachingOpportunities: Array<{
        topic: string;
        suggestedApproach: string;
        bloomsLevel: string;
    }>;
    transcript: string;
    visualElements: string[];
    estimatedDifficultyLevel: string;
    prerequisites: string[];
    suggestedDuration: string;
}

export interface SourceAnalysis {
    sourceId: string;
    analysisData: GeminiVideoAnalysis;
    processingTime: number;
    cost: number;
    modelUsed: string;
}
