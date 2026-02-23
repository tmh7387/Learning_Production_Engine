import type { TranscriptSegment } from '@/types/sources';

interface YouTubeTranscriptItem {
    text: string;
    duration: number;
    offset: number;
}

export class TranscriptService {
    /**
     * Fetch transcript from YouTube using youtube-transcript library
     * This is more reliable and faster than Gemini for transcript-only extraction
     */
    async fetchYouTubeTranscript(videoUrl: string): Promise<TranscriptSegment[]> {
        try {
            const videoId = this.extractVideoId(videoUrl);
            if (!videoId) {
                throw new Error('Invalid YouTube URL');
            }

            // Dynamic import for youtube-transcript (ESM module)
            const { YoutubeTranscript } = await import('youtube-transcript');
            const transcript: YouTubeTranscriptItem[] = await YoutubeTranscript.fetchTranscript(videoId);

            return transcript.map((segment) => ({
                text: segment.text,
                start: segment.offset / 1000, // Convert ms to seconds
                duration: segment.duration / 1000,
                offset: segment.offset,
            }));
        } catch (error) {
            console.error('Transcript fetch error:', error);
            throw new Error(
                `Failed to fetch transcript: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Get full transcript as plain text
     */
    async getTranscriptText(videoUrl: string): Promise<string> {
        const segments = await this.fetchYouTubeTranscript(videoUrl);
        return segments.map((s) => s.text).join(' ');
    }

    /**
     * Get transcript with timestamps (formatted for display)
     */
    formatTranscriptWithTimestamps(segments: TranscriptSegment[]): string {
        return segments
            .map((s) => {
                const timestamp = this.formatTimestamp(s.start);
                return `[${timestamp}] ${s.text}`;
            })
            .join('\n');
    }

    private extractVideoId(url: string): string | null {
        const patterns = [
            /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
            /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
            /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
            /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }

    private formatTimestamp(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

export const transcriptService = new TranscriptService();
