export const config = {
    maxVideoDurationMinutes: parseInt(process.env.MAX_VIDEO_DURATION_MINUTES || '60', 10),
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10),
    gemini: {
        model: 'gemini-1.5-pro',
        embeddingModel: 'text-embedding-004',
    },
    claude: {
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 8192,
    },
    supabase: {
        storageBucket: 'source-files',
    },
};
