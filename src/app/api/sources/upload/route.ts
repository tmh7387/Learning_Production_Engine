import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';
import { config } from '@/lib/config';

export async function POST(request: NextRequest) {
    try {
        // Authenticate user
        const supabase = createServerComponentClient({ cookies });
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user's organization
        const { data: orgMembership } = await supabase
            .from('user_organizations')
            .select('organization_id')
            .eq('user_id', user.id)
            .single();

        if (!orgMembership) {
            return NextResponse.json({ error: 'No organization found' }, { status: 400 });
        }

        // Parse multipart form data
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ];

        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json(
                { error: 'Only PDF and PPTX files are supported' },
                { status: 400 }
            );
        }

        // Validate file size
        const maxSizeMB = config.maxFileSizeMB;
        if (file.size > maxSizeMB * 1024 * 1024) {
            return NextResponse.json(
                { error: `File size exceeds ${maxSizeMB}MB limit` },
                { status: 400 }
            );
        }

        // Upload to Supabase Storage
        const serviceClient = createServiceClient();
        const fileExt = file.name.split('.').pop();
        const filePath = `${orgMembership.organization_id}/${Date.now()}-${file.name}`;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { data: uploadData, error: uploadError } = await serviceClient.storage
            .from(config.supabase.storageBucket)
            .upload(filePath, buffer, {
                contentType: file.type,
                upsert: false,
            });

        if (uploadError) {
            return NextResponse.json(
                { error: `Upload failed: ${uploadError.message}` },
                { status: 500 }
            );
        }

        // Get public URL
        const {
            data: { publicUrl },
        } = serviceClient.storage
            .from(config.supabase.storageBucket)
            .getPublicUrl(filePath);

        return NextResponse.json({
            success: true,
            fileName: file.name,
            filePath,
            publicUrl,
            sourceType: fileExt === 'pdf' ? 'pdf' : 'pptx',
            fileBuffer: buffer.toString('base64'),
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json(
            {
                error: 'Upload failed',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
