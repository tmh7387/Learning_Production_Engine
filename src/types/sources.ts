export type SourceType = 'youtube' | 'pdf' | 'pptx' | 'url';

export interface Source {
    id: string;
    organizationId: string;
    sourceType: SourceType;
    sourceUrl: string;
    title: string | null;
    metadata: Record<string, unknown> | null;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    createdAt: string;
    updatedAt: string;
}

export interface SourceWithTranscript extends Source {
    transcript: TranscriptSegment[] | null;
    duration_seconds: number | null;
    thumbnail_url: string | null;
}

export interface TranscriptSegment {
    text: string;
    start: number; // seconds
    duration: number; // seconds
    offset: number; // milliseconds (for compatibility)
}
