import axios from 'axios';
import { config } from '@/lib/config';

interface VideoMetadata {
    title: string;
    duration: number;
    thumbnailUrl: string;
    channelName: string;
    description: string;
}

export class YouTubeService {
    /**
     * Validates a YouTube URL and returns the video ID.
     */
    static extractVideoId(url: string): string | null {
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

    /**
     * Fetches video metadata using the oEmbed API (no API key required).
     */
    static async getMetadata(url: string): Promise<VideoMetadata> {
        const videoId = this.extractVideoId(url);
        if (!videoId) {
            throw new Error('Invalid YouTube URL');
        }

        try {
            const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
            const response = await axios.get(oembedUrl);

            return {
                title: response.data.title || 'Untitled',
                duration: 0, // oEmbed doesn't return duration; Gemini handles video analysis directly
                thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                channelName: response.data.author_name || 'Unknown',
                description: '',
            };
        } catch {
            // Fallback metadata
            return {
                title: 'YouTube Video',
                duration: 0,
                thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                channelName: 'Unknown',
                description: '',
            };
        }
    }

    /**
     * Validates that a YouTube URL is processable.
     */
    static async validate(url: string): Promise<{ valid: boolean; error?: string }> {
        const videoId = this.extractVideoId(url);
        if (!videoId) {
            return { valid: false, error: 'Invalid YouTube URL format' };
        }

        try {
            await this.getMetadata(url);
            return { valid: true };
        } catch {
            return { valid: false, error: 'Could not access video. It may be private or unavailable.' };
        }
    }

    /**
     * Returns the direct YouTube URL for Gemini's native video understanding.
     * Gemini 1.5 Pro can analyze YouTube videos directly via URL — no download needed.
     */
    static getVideoUrl(url: string): string {
        const videoId = this.extractVideoId(url);
        if (!videoId) throw new Error('Invalid YouTube URL');
        return `https://www.youtube.com/watch?v=${videoId}`;
    }
}
