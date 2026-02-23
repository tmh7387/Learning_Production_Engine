export interface SourceCollection {
    id: string;
    organization_id: string;
    title: string;
    description: string | null;
    status: 'building' | 'analyzing' | 'ready' | 'failed';
    analysis_completed_at: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface CollectionSource {
    id: string;
    collection_id: string;
    source_id: string;
    order_index: number;
    contribution_notes: string | null;
    added_at: string;
}

export interface CollectionSummary {
    total_sources: number;
    sources_analyzed: number;
    status: string;
    last_updated: string;
}

export interface CollectionWithSources extends SourceCollection {
    sources: Array<{
        id: string;
        source_type: string;
        source_url: string;
        title: string;
        status: string;
        order_index: number;
    }>;
    summary?: CollectionSummary;
}

export interface CollectionAnalysis {
    id: string;
    collection_id: string;
    analysis_type: string;
    analysis_data: CrossSourceSynthesis;
    sources_analyzed: number;
    processing_time_ms: number;
    cost_usd: number;
    model_used: string;
    created_at: string;
}

export interface CrossSourceSynthesis {
    unifiedThemes: Array<{
        theme: string;
        description: string;
        sourcesContributing: string[];
        importance: 'high' | 'medium' | 'low';
    }>;

    sourceContributions: Record<string, {
        uniqueTopics: string[];
        reinforcedTopics: string[];
        primaryFocus: string;
        bloomsLevels: string[];
    }>;

    knowledgeGaps: Array<{
        gap: string;
        description: string;
        suggestedContent: string;
    }>;

    recommendedSequence: Array<{
        step: number;
        sourceIds: string[];
        rationale: string;
        estimatedDuration: string;
    }>;

    synthesisStrategy: string;
    overallComplexity: 'beginner' | 'intermediate' | 'advanced';
    prerequisites: string[];
}
