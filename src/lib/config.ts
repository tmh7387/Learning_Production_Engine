export const config = {
    maxVideoDurationMinutes: parseInt(process.env.MAX_VIDEO_DURATION_MINUTES || '60', 10),
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10),
    gemini: {
        model: 'gemini-3.1-pro-preview',
        embeddingModel: 'text-embedding-004',
    },
    claude: {
        model: 'claude-sonnet-4-6',
        maxTokens: 8192,
    },
    supabase: {
        storageBucket: 'source-files',
    },
};
