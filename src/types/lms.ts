export interface CourseSection {
    id: string;
    module_id: string;
    section_number: number;
    title: string;
    description: string | null;
    duration_minutes: number | null;
    order_index: number;
    created_at: string;
    updated_at: string;
}

export interface CourseAsset {
    id: string;
    course_id: string;
    module_id: string | null;
    section_id: string | null;
    asset_type: AssetType;
    title: string;
    description: string | null;
    file_url: string;
    file_size_mb: number | null;
    mime_type: string | null;
    generated_by: GeneratorType | null;
    generation_prompt: string | null;
    metadata: Record<string, unknown>;
    is_reusable: boolean;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export type AssetType =
    | 'video'
    | 'pdf'
    | 'pptx'
    | 'docx'
    | 'infographic'
    | 'quiz'
    | 'simulation'
    | 'audio'
    | 'scorm_package'
    | 'other';

export type GeneratorType =
    | 'notebooklm'
    | 'gamma'
    | 'heygen'
    | 'canva'
    | 'internal'
    | 'uploaded';

export interface Assessment {
    id: string;
    course_id: string;
    module_id: string | null;
    section_id: string | null;
    title: string;
    assessment_type: AssessmentType;
    time_limit_minutes: number | null;
    passing_score: number | null;
    total_points: number | null;
    instructions: string | null;
    questions: QuizQuestion[];
    created_by: string;
    created_at: string;
    updated_at: string;
}

export type AssessmentType =
    | 'quiz'
    | 'practical'
    | 'simulation'
    | 'oral_exam'
    | 'written_exam'
    | 'project';

export interface QuizQuestion {
    id: string;
    question: string;
    type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
    options?: string[];
    correct_answer?: string | string[];
    points: number;
    explanation?: string;
    blooms_level?: string;
}

export interface Export {
    id: string;
    course_id: string;
    export_type: ExportType;
    export_url: string | null;
    external_id: string | null;
    file_path: string | null;
    metadata: Record<string, unknown>;
    exported_by: string;
    created_at: string;
}

export type ExportType =
    | 'scorm_1.2'
    | 'scorm_2004'
    | 'xapi'
    | 'docx'
    | 'pdf'
    | 'notebooklm'
    | 'gamma'
    | 'heygen'
    | 'canva'
    | 'custom';

export interface NotebookLMBundle {
    collectionTitle: string;
    sources: Array<{
        type: 'youtube' | 'text' | 'web';
        url?: string;
        text?: string;
        title: string;
    }>;
    lessonPlanSummary: string;
    mcpInstructions: string;
}

export interface GammaBundle {
    title: string;
    slides: Array<{
        type: 'title' | 'content' | 'image' | 'quote';
        content: string;
        bullets?: string[];
        imageUrl?: string;
    }>;
    markdown: string;
    instructions: string;
}

export interface HeyGenBundle {
    title: string;
    script: string;
    scenes: Array<{
        sceneNumber: number;
        title: string;
        narration: string;
        visualSuggestions: string[];
        duration?: string;
    }>;
    instructions: string;
}
