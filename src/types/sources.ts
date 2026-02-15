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
