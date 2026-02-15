'use client';

import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { LinkIcon, DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';
import { Modal } from '@/components/shared/Modal';

interface SourceInputProps {
    onSourceAdded: (result: { courseId: string; moduleId: string }) => void;
}

export function SourceInput({ onSourceAdded }: SourceInputProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [inputMethod, setInputMethod] = useState<'url' | 'upload'>('url');
    const [url, setUrl] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState('');

    const handleSubmit = async () => {
        setIsProcessing(true);
        setProgress('Starting analysis...');

        try {
            let sourceUrl = url;
            let sourceType: 'youtube' | 'pdf' | 'pptx' = 'youtube';

            // If file upload, upload first
            if (inputMethod === 'upload' && file) {
                setProgress('Uploading file...');

                const formData = new FormData();
                formData.append('file', file);

                const uploadResponse = await fetch('/api/sources/upload', {
                    method: 'POST',
                    body: formData,
                });

                if (!uploadResponse.ok) {
                    throw new Error('File upload failed');
                }

                const uploadData = await uploadResponse.json();
                sourceUrl = uploadData.publicUrl;
                sourceType = file.type.includes('pdf') ? 'pdf' : 'pptx';
            }

            // Analyze source
            setProgress('Analyzing content with AI...');

            const response = await fetch('/api/sources/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceType,
                    sourceUrl,
                    options: {
                        duration: 60,
                        audience: 'intermediate',
                        template: 'iata',
                    },
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.details || 'Analysis failed');
            }

            const result = await response.json();

            toast.success('Lesson plan generated successfully!');
            setIsOpen(false);
            onSourceAdded(result);

            // Reset form
            setUrl('');
            setFile(null);

        } catch (error) {
            console.error('Source processing error:', error);
            toast.error(error instanceof Error ? error.message : 'Processing failed');
        } finally {
            setIsProcessing(false);
            setProgress('');
        }
    };

    return (
        <>
            <Button
                onClick={() => setIsOpen(true)}
                className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
                Generate from Source
            </Button>

            <Modal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                title="Generate Lesson from Source"
            >
                <div className="space-y-6">
                    {/* Input method selector */}
                    <div className="flex gap-4">
                        <button
                            onClick={() => setInputMethod('url')}
                            className={`flex-1 p-4 border-2 rounded-lg ${inputMethod === 'url'
                                    ? 'border-indigo-600 bg-indigo-50'
                                    : 'border-gray-200'
                                }`}
                        >
                            <LinkIcon className="h-6 w-6 mx-auto mb-2" />
                            <div className="font-medium">URL</div>
                            <div className="text-sm text-gray-500">YouTube or web link</div>
                        </button>

                        <button
                            onClick={() => setInputMethod('upload')}
                            className={`flex-1 p-4 border-2 rounded-lg ${inputMethod === 'upload'
                                    ? 'border-indigo-600 bg-indigo-50'
                                    : 'border-gray-200'
                                }`}
                        >
                            <DocumentArrowUpIcon className="h-6 w-6 mx-auto mb-2" />
                            <div className="font-medium">Upload File</div>
                            <div className="text-sm text-gray-500">PDF or PowerPoint</div>
                        </button>
                    </div>

                    {/* URL input */}
                    {inputMethod === 'url' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Video or Document URL
                            </label>
                            <Input
                                type="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://youtube.com/watch?v=..."
                                disabled={isProcessing}
                            />
                            <p className="mt-2 text-sm text-gray-500">
                                Paste a YouTube video URL or link to training content
                            </p>
                        </div>
                    )}

                    {/* File upload */}
                    {inputMethod === 'upload' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Upload File
                            </label>
                            <input
                                type="file"
                                accept=".pdf,.pptx"
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                disabled={isProcessing}
                                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-indigo-50 file:text-indigo-700
                  hover:file:bg-indigo-100"
                            />
                            {file && (
                                <p className="mt-2 text-sm text-gray-600">
                                    Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                </p>
                            )}
                        </div>
                    )}

                    {/* Processing status */}
                    {isProcessing && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-center">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
                                <span className="text-sm text-blue-700">{progress}</span>
                            </div>
                            <div className="mt-3 w-full bg-blue-200 rounded-full h-2">
                                <div className="bg-blue-600 h-2 rounded-full animate-pulse w-3/4"></div>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-3">
                        <Button
                            onClick={() => setIsOpen(false)}
                            variant="secondary"
                            disabled={isProcessing}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={isProcessing || (!url && !file)}
                        >
                            {isProcessing ? 'Processing...' : 'Generate Lesson'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
}