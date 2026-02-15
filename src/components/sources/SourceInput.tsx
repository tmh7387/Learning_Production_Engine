'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';
import { Modal } from '@/components/shared/Modal';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import toast from 'react-hot-toast';

interface SourceInputProps {
    onLessonGenerated: (courseId: string) => void;
}

type InputMethod = 'url' | 'file' | 'notebook';
type ProcessingStep = 'idle' | 'uploading' | 'analyzing' | 'generating' | 'complete';

const STEP_LABELS: Record<ProcessingStep, string> = {
    idle: '',
    uploading: 'Uploading file...',
    analyzing: 'Analyzing content with Gemini AI...',
    generating: 'Generating IATA lesson plan with Claude...',
    complete: 'Lesson plan ready!',
};

export function SourceInput({ onLessonGenerated }: SourceInputProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [inputMethod, setInputMethod] = useState<InputMethod>('url');
    const [url, setUrl] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [notebookId, setNotebookId] = useState('');
    const [notebookContent, setNotebookContent] = useState('');
    const [step, setStep] = useState<ProcessingStep>('idle');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isProcessing = step !== 'idle' && step !== 'complete';

    const handleSubmit = async () => {
        try {
            if (inputMethod === 'url') {
                if (!url.trim()) {
                    toast.error('Please enter a YouTube URL');
                    return;
                }

                setStep('analyzing');

                const res = await fetch('/api/sources/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sourceUrl: url, sourceType: 'youtube' }),
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || 'Analysis failed');
                }

                setStep('complete');
                toast.success('Lesson plan generated successfully!');
                onLessonGenerated(data.courseId);
            } else if (inputMethod === 'file') {
                if (!file) {
                    toast.error('Please select a file');
                    return;
                }

                // Step 1: Upload file
                setStep('uploading');
                const formData = new FormData();
                formData.append('file', file);

                const uploadRes = await fetch('/api/sources/upload', {
                    method: 'POST',
                    body: formData,
                });

                const uploadData = await uploadRes.json();

                if (!uploadRes.ok) {
                    throw new Error(uploadData.error || 'Upload failed');
                }

                // Step 2: Analyze uploaded file
                setStep('analyzing');

                const analyzeRes = await fetch('/api/sources/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sourceUrl: uploadData.publicUrl,
                        sourceType: uploadData.sourceType,
                    }),
                });

                const analyzeData = await analyzeRes.json();

                if (!analyzeRes.ok) {
                    throw new Error(analyzeData.error || 'Analysis failed');
                }

                setStep('complete');
                toast.success('Lesson plan generated successfully!');
                onLessonGenerated(analyzeData.courseId);
            } else if (inputMethod === 'notebook') {
                // NotebookLM source
                if (!notebookId.trim() || !notebookContent.trim()) {
                    toast.error('Please enter both a Notebook ID and content');
                    return;
                }

                setStep('analyzing');

                const res = await fetch('/api/sources/from-notebook', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        notebookId: notebookId.trim(),
                        organizationId: 'default',
                        notebookContent: {
                            title: `NotebookLM: ${notebookId.trim()}`,
                            text: notebookContent,
                        },
                    }),
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || 'Notebook processing failed');
                }

                setStep('complete');
                toast.success('Lesson plan generated from NotebookLM!');
                onLessonGenerated(data.courseId);
            }
        } catch (error) {
            setStep('idle');
            toast.error(error instanceof Error ? error.message : 'Something went wrong');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (selected) {
            const validTypes = [
                'application/pdf',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            ];
            if (!validTypes.includes(selected.type)) {
                toast.error('Only PDF and PPTX files are supported');
                return;
            }
            setFile(selected);
        }
    };

    const reset = () => {
        setUrl('');
        setFile(null);
        setNotebookId('');
        setNotebookContent('');
        setStep('idle');
        setIsOpen(false);
    };

    return (
        <>
            <Button size="lg" onClick={() => setIsOpen(true)}>
                Generate from Source
            </Button>

            <Modal
                isOpen={isOpen}
                onClose={isProcessing ? () => { } : reset}
                title="Generate Lesson Plan"
                size="lg"
            >
                {isProcessing ? (
                    <div className="py-12">
                        <LoadingSpinner size="lg" message={STEP_LABELS[step]} />

                        {/* Progress steps */}
                        <div className="mt-8 space-y-3">
                            {(['uploading', 'analyzing', 'generating'] as ProcessingStep[]).map(
                                (s, i) => {
                                    const isActive = step === s;
                                    const isDone =
                                        (['uploading', 'analyzing', 'generating'].indexOf(step as string) >
                                            i) ||
                                        (step as string) === 'complete';

                                    if (s === 'uploading' && inputMethod === 'url') return null;

                                    return (
                                        <div key={s} className="flex items-center gap-3">
                                            <div
                                                className={`h-2.5 w-2.5 rounded-full transition-colors ${isDone
                                                    ? 'bg-green-500'
                                                    : isActive
                                                        ? 'bg-primary-500 animate-pulse'
                                                        : 'bg-gray-200'
                                                    }`}
                                            />
                                            <span
                                                className={`text-sm ${isDone
                                                    ? 'text-green-700'
                                                    : isActive
                                                        ? 'text-primary-700 font-medium'
                                                        : 'text-gray-400'
                                                    }`}
                                            >
                                                {STEP_LABELS[s]}
                                            </span>
                                        </div>
                                    );
                                }
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Input method tabs */}
                        <div className="flex rounded-lg bg-gray-100 p-1">
                            <button
                                onClick={() => setInputMethod('url')}
                                className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${inputMethod === 'url'
                                    ? 'bg-white text-primary-700 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                YouTube URL
                            </button>
                            <button
                                onClick={() => setInputMethod('file')}
                                className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${inputMethod === 'file'
                                    ? 'bg-white text-primary-700 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                Upload File
                            </button>
                            <button
                                onClick={() => setInputMethod('notebook')}
                                className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${inputMethod === 'notebook'
                                    ? 'bg-white text-primary-700 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                NotebookLM
                            </button>
                        </div>

                        {/* URL input */}
                        {inputMethod === 'url' && (
                            <Input
                                label="YouTube Video URL"
                                placeholder="https://www.youtube.com/watch?v=..."
                                value={url}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                                helperText="Paste a YouTube video URL to analyze and generate a lesson plan"
                            />
                        )}

                        {/* File upload */}
                        {inputMethod === 'file' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Upload Document
                                </label>
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer
                    hover:border-primary-400 hover:bg-primary-50/30 transition-all duration-200"
                                >
                                    {file ? (
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">
                                                {file.name}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {(file.size / 1024 / 1024).toFixed(1)} MB
                                            </p>
                                        </div>
                                    ) : (
                                        <div>
                                            <svg
                                                className="mx-auto h-10 w-10 text-gray-400"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={1.5}
                                                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                                />
                                            </svg>
                                            <p className="mt-2 text-sm text-gray-600">
                                                Click to upload PDF or PPTX
                                            </p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                Max 50 MB
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf,.pptx"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                            </div>
                        )}

                        {/* NotebookLM input */}
                        {inputMethod === 'notebook' && (
                            <div className="space-y-4">
                                <Input
                                    label="NotebookLM Notebook ID"
                                    placeholder="Enter the notebook UUID"
                                    value={notebookId}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotebookId(e.target.value)}
                                    helperText="The UUID of the NotebookLM notebook to use as source"
                                />
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Notebook Content
                                    </label>
                                    <textarea
                                        value={notebookContent}
                                        onChange={(e) => setNotebookContent(e.target.value)}
                                        placeholder="Paste the notebook content or query results here..."
                                        rows={8}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                                            focus:border-primary-500 focus:ring-2 focus:ring-primary-200
                                            transition-all duration-200 resize-none"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        Paste content from NotebookLM to generate an IATA lesson plan
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Submit */}
                        <div className="flex justify-end gap-3 pt-2">
                            <Button variant="secondary" onClick={reset}>
                                Cancel
                            </Button>
                            <Button onClick={handleSubmit}>
                                Generate Lesson Plan
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
}
