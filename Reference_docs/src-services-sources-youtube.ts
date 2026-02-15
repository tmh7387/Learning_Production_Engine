import ytdl from 'ytdl-core';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

export class YouTubeService {
    private downloadsDir: string;

    constructor() {
        // Use temp directory for downloads
        this.downloadsDir = path.join(process.cwd(), 'tmp', 'videos');
        this.ensureDownloadDir();
    }

    private async ensureDownloadDir() {
        try {
            await mkdir(this.downloadsDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create downloads directory:', error);
        }
    }

    /**
     * Download YouTube video
     */
    async downloadVideo(url: string, sourceId: string): Promise<string> {
        try {
            // Validate URL
            if (!ytdl.validateURL(url)) {
                throw new Error('Invalid YouTube URL');
            }

            // Get video info
            const info = await ytdl.getInfo(url);
            const videoId = info.videoDetails.videoId;

            // Set output path
            const outputPath = path.join(this.downloadsDir, `${sourceId}-${videoId}.mp4`);

            // Download video
            await new Promise<void>((resolve, reject) => {
                ytdl(url, {
                    quality: 'highest',
                    filter: 'videoandaudio',
                })
                    .pipe(fs.createWriteStream(outputPath))
                    .on('finish', () => resolve())
                    .on('error', (error) => reject(error));
            });

            return outputPath;
        } catch (error) {
            console.error('YouTube download error:', error);
            throw new Error(`Failed to download video: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Extract video metadata
     */
    async getVideoMetadata(url: string) {
        try {
            const info = await ytdl.getInfo(url);

            return {
                videoId: info.videoDetails.videoId,
                title: info.videoDetails.title,
                description: info.videoDetails.description,
                duration: parseInt(info.videoDetails.lengthSeconds),
                thumbnail: info.videoDetails.thumbnails[0]?.url,
                author: info.videoDetails.author.name,
                viewCount: parseInt(info.videoDetails.viewCount),
                uploadDate: info.videoDetails.uploadDate,
            };
        } catch (error) {
            console.error('Metadata extraction error:', error);
            throw error;
        }
    }

    /**
     * Validate video is suitable for processing
     */
    async validateVideo(url: string): Promise<{ valid: boolean; error?: string }> {
        try {
            const metadata = await this.getVideoMetadata(url);

            // Check duration (max 60 minutes)
            const maxDuration = parseInt(process.env.MAX_VIDEO_DURATION_MINUTES || '60') * 60;
            if (metadata.duration > maxDuration) {
                return {
                    valid: false,
                    error: `Video too long. Maximum duration is ${maxDuration / 60} minutes.`,
                };
            }

            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error.message : 'Validation failed',
            };
        }
    }
}

export const youtubeService = new YouTubeService();