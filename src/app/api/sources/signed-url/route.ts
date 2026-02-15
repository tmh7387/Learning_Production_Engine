import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/sources/signed-url
 *
 * Generate a signed URL for direct browser-to-Supabase file upload.
 * Bypasses the serverless function body size limit (~6MB on Netlify).
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = createServiceClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { fileName, fileType, fileSize } = await request.json();

        if (!fileName || !fileType) {
            return NextResponse.json(
                { error: 'fileName and fileType are required' },
                { status: 400 }
            );
        }

        // Validate file type
        const allowedTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ];
        if (!allowedTypes.includes(fileType)) {
            return NextResponse.json(
                { error: 'Unsupported file type. Only PDF and PPTX are allowed.' },
                { status: 400 }
            );
        }

        // Validate file size (50MB max)
        const MAX_SIZE = 50 * 1024 * 1024;
        if (fileSize && fileSize > MAX_SIZE) {
            return NextResponse.json(
                { error: `File size exceeds ${MAX_SIZE / (1024 * 1024)}MB limit` },
                { status: 400 }
            );
        }

        // Generate unique path
        const ext = fileName.split('.').pop();
        const storagePath = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

        // Create signed upload URL (valid for 5 minutes)
        const { data, error } = await supabase.storage
            .from('source-files')
            .createSignedUploadUrl(storagePath);

        if (error) {
            console.error('Signed URL error:', error);
            return NextResponse.json(
                { error: 'Failed to create upload URL' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            signedUrl: data.signedUrl,
            path: storagePath,
            token: data.token,
        });
    } catch (error) {
        console.error('Signed URL route error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
            { status: 500 }
        );
    }
}
