'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';
import { Modal } from '@/components/shared/Modal';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { CollectionSourceList } from './CollectionSourceList';
import toast from 'react-hot-toast';

interface CollectionBuilderProps {
    onCourseGenerated: (courseId: string) => void;
}

type BuilderStep = 'create' | 'sources' | 'processing' | 'complete';
type ProcessingPhase =
    | 'idle'
    | 'adding_source'
    | 'uploading_file'
    | 'analyzing_collection'
    | 'generating_lesson'
    | 'complete';

const PHASE_LABELS: Record<ProcessingPhase, string> = {
    idle: '',
    adding_source: 'Adding and analyzing source...',
    uploading_file: 'Uploading file...',
    analyzing_collection: 'Synthesizing across all sources with Claude...',
    generating_lesson: 'Generating IATA lesson plan...',
    complete: 'Lesson plan ready!',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface CollectionData {
    id: string;
    title: string;
    description: string | null;
    status: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    collection_sources: any[];
}

export function CollectionBuilder({ onCourseGenerated }: CollectionBuilderProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [builderStep, setBuilderStep] = useState<BuilderStep>('create');
    const [phase, setPhase] = useState<ProcessingPhase>('idle');

    // Create form
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');

    // Collection state
    const [collection, setCollection] = useState<CollectionData | null>(null);

    // Add source form
    const [sourceUrl, setSourceUrl] = useState('');
    const [sourceType, setSourceType] = useState<'youtube' | 'pdf' | 'pptx'>('youtube');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isProcessing = phase !== 'idle' && phase !== 'complete';

    const reset = useCallback(() => {
        setIsOpen(false);
        setBuilderStep('create');
        setPhase('idle');
        setTitle('');
        setDescription('');
        setCollection(null);
        setSourceUrl('');
        setSourceType('youtube');
        setSelectedFile(null);
        setIsDragging(false);
    }, []);

    const handleCreate = async () => {
        if (!title.trim()) {
            toast.error('Please enter a collection title');
            return;
        }

        try {
            const res = await fetch('/api/collections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim() || undefined,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create collection');

            setCollection(data.collection);
            setBuilderStep('sources');
            toast.success('Collection created!');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Something went wrong');
        }
    };

    const handleAddYouTubeSource = async () => {
        if (!sourceUrl.trim()) {
            toast.error('Please enter a YouTube URL');
            return;
        }
        if (!collection) return;

        try {
            setPhase('adding_source');

            const res = await fetch(`/api/collections/${collection.id}/sources`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceUrl: sourceUrl.trim(),
                    sourceType: 'youtube',
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || data.details || 'Failed to add source');

            await refreshCollection();
            setSourceUrl('');
            setPhase('idle');
            toast.success('Source added and analyzed!');
        } catch (error) {
            setPhase('idle');
            toast.error(error instanceof Error ? error.message : 'Failed to add source');
        }
    };

    const handleAddFileSource = async () => {
        if (!selectedFile) {
            toast.error('Please select a file');
            return;
        }
        if (!collection) return;

        try {
            // Step 1: Upload file to Supabase Storage
            setPhase('uploading_file');
            const formData = new FormData();
            formData.append('file', selectedFile);

            const uploadRes = await fetch('/api/sources/upload', {
                method: 'POST',
                body: formData,
            });

            const uploadData = await uploadRes.json();
            if (!uploadRes.ok) throw new Error(uploadData.error || 'File upload failed');

            // Step 2: Add to collection with the file data
            setPhase('adding_source');
            const res = await fetch(`/api/collections/${collection.id}/sources`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceUrl: uploadData.publicUrl,
                    sourceType: uploadData.sourceType,
                    fileBuffer: uploadData.fileBuffer,
                    fileName: uploadData.fileName,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || data.details || 'Failed to add source');

            await refreshCollection();
            setSelectedFile(null);
            setPhase('idle');
            toast.success(`${selectedFile.name} added and analyzed!`);
        } catch (error) {
            setPhase('idle');
            toast.error(error instanceof Error ? error.message : 'Failed to add source');
        }
    };

    const handleGenerate = async () => {
        if (!collection) return;

        try {
            setBuilderStep('processing');

            // Step 1: Cross-source analysis (if 2+ sources)
            if (collection.collection_sources.length >= 2) {
                setPhase('analyzing_collection');
                const analyzeRes = await fetch(`/api/collections/${collection.id}/analyze`, {
                    method: 'POST',
                });
                const analyzeData = await analyzeRes.json();
                if (!analyzeRes.ok) throw new Error(analyzeData.error || 'Analysis failed');
            }

            // Step 2: Generate lesson
            setPhase('generating_lesson');
            const genRes = await fetch(`/api/collections/${collection.id}/generate`, {
                method: 'POST',
            });
            const genData = await genRes.json();
            if (!genRes.ok) throw new Error(genData.error || 'Generation failed');

            setPhase('complete');
            toast.success('Lesson plan generated from collection!');
            setTimeout(() => {
                reset();
                onCourseGenerated(genData.courseId);
            }, 1000);
        } catch (error) {
            setPhase('idle');
            setBuilderStep('sources');
            toast.error(error instanceof Error ? error.message : 'Generation failed');
        }
    };

    const refreshCollection = async () => {
        if (!collection) return;

        const res = await fetch(`/api/collections/${collection.id}`);
        const data = await res.json();
        if (res.ok) {
            setCollection(data.collection);
        }
    };

    // File drag-and-drop handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) {
            validateAndSetFile(file);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            validateAndSetFile(file);
        }
    };

    const validateAndSetFile = (file: File) => {
        const validTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ];
        if (!validTypes.includes(file.type)) {
            toast.error('Only PDF and PPTX files are supported');
            return;
        }
        if (file.size > 50 * 1024 * 1024) {
            toast.error('File size must be under 50MB');
            return;
        }
        setSelectedFile(file);
        // Auto-detect source type from file extension
        if (file.name.endsWith('.pdf')) {
            setSourceType('pdf');
        } else if (file.name.endsWith('.pptx')) {
            setSourceType('pptx');
        }
    };

    const sourceCount = collection?.collection_sources?.length || 0;

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium
                    bg-white text-primary-700 border border-primary-200
                    hover:bg-primary-50 hover:border-primary-300
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
                    transition-all duration-200 shadow-sm hover:shadow-md"
            >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Build from Collection
            </button>

            <Modal
                isOpen={isOpen}
                onClose={isProcessing ? () => { } : reset}
                title={
                    builderStep === 'create'
                        ? 'Create Source Collection'
                        : builderStep === 'processing'
                            ? 'Generating Lesson Plan'
                            : `Collection: ${collection?.title || ''}`
                }
                size="lg"
            >
                {/* Step 1: Create collection */}
                {builderStep === 'create' && (
                    <div className="space-y-5">
                        <p className="text-sm text-gray-500">
                            Group multiple sources together, then generate a comprehensive lesson plan that synthesizes all of them.
                        </p>

                        <Input
                            label="Collection Title"
                            placeholder="e.g., Ground Operations Safety Training"
                            value={title}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                        />

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Description <span className="text-gray-400 font-normal">(optional)</span>
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Brief description of what this collection covers..."
                                rows={3}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                                    focus:border-primary-500 focus:ring-2 focus:ring-primary-200
                                    transition-all duration-200 resize-none"
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <Button variant="secondary" onClick={reset}>Cancel</Button>
                            <Button onClick={handleCreate}>Create Collection</Button>
                        </div>
                    </div>
                )}

                {/* Step 2: Add sources */}
                {builderStep === 'sources' && (
                    <div className="space-y-5">
                        {/* Source list */}
                        <CollectionSourceList sources={collection?.collection_sources || []} />

                        {/* Add source form */}
                        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                            <h4 className="text-sm font-medium text-gray-700">Add Source</h4>

                            {/* Source type selector */}
                            <div className="flex rounded-lg bg-white border border-gray-200 p-0.5">
                                {(['youtube', 'pdf', 'pptx'] as const).map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => {
                                            setSourceType(type);
                                            setSelectedFile(null);
                                            setSourceUrl('');
                                        }}
                                        className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all ${sourceType === type
                                            ? 'bg-primary-100 text-primary-700 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        {type === 'youtube' ? '▶ YouTube' : type === 'pdf' ? '📄 PDF' : '📊 PPTX'}
                                    </button>
                                ))}
                            </div>

                            {/* YouTube: URL input */}
                            {sourceType === 'youtube' && (
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <Input
                                            placeholder="https://youtube.com/watch?v=..."
                                            value={sourceUrl}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSourceUrl(e.target.value)}
                                        />
                                    </div>
                                    <Button
                                        onClick={handleAddYouTubeSource}
                                        loading={phase === 'adding_source'}
                                        disabled={isProcessing}
                                        size="sm"
                                    >
                                        Add
                                    </Button>
                                </div>
                            )}

                            {/* PDF/PPTX: File upload with drag-and-drop */}
                            {(sourceType === 'pdf' || sourceType === 'pptx') && (
                                <div className="space-y-3">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileSelect}
                                        accept={sourceType === 'pdf' ? '.pdf' : '.pptx'}
                                        className="hidden"
                                    />

                                    {!selectedFile ? (
                                        <div
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                            onClick={() => fileInputRef.current?.click()}
                                            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                                                transition-all duration-200 ${isDragging
                                                    ? 'border-primary-400 bg-primary-50'
                                                    : 'border-gray-300 hover:border-primary-300 hover:bg-gray-100'
                                                }`}
                                        >
                                            <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                            </svg>
                                            <p className="mt-2 text-sm text-gray-600">
                                                <span className="font-medium text-primary-600">Click to browse</span> or drag & drop
                                            </p>
                                            <p className="mt-1 text-xs text-gray-400">
                                                {sourceType === 'pdf' ? 'PDF files up to 50MB' : 'PPTX files up to 50MB'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span className="text-xl flex-shrink-0">
                                                    {sourceType === 'pdf' ? '📄' : '📊'}
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 truncate">{selectedFile.name}</p>
                                                    <p className="text-xs text-gray-400">
                                                        {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <button
                                                    onClick={() => setSelectedFile(null)}
                                                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                                    title="Remove file"
                                                >
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                                <Button
                                                    onClick={handleAddFileSource}
                                                    loading={phase === 'uploading_file' || phase === 'adding_source'}
                                                    disabled={isProcessing}
                                                    size="sm"
                                                >
                                                    Upload & Add
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Info about source count */}
                        {sourceCount > 0 && sourceCount < 2 && (
                            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
                                <svg className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-xs text-amber-700">
                                    Add at least 2 sources for cross-source synthesis. You can generate with 1 source, but the analysis won&apos;t include cross-referencing.
                                </p>
                            </div>
                        )}

                        {/* Generate button */}
                        <div className="flex justify-between items-center pt-2">
                            <p className="text-xs text-gray-400">
                                {sourceCount} source{sourceCount !== 1 ? 's' : ''} in collection
                            </p>
                            <div className="flex gap-3">
                                <Button variant="secondary" onClick={reset}>Cancel</Button>
                                <Button
                                    onClick={handleGenerate}
                                    disabled={sourceCount === 0}
                                >
                                    Generate Lesson Plan
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 3: Processing */}
                {builderStep === 'processing' && (
                    <div className="py-12">
                        <LoadingSpinner size="lg" message={PHASE_LABELS[phase]} />

                        <div className="mt-8 space-y-3">
                            {(['analyzing_collection', 'generating_lesson'] as ProcessingPhase[]).map(
                                (p, i) => {
                                    const phases: ProcessingPhase[] = ['analyzing_collection', 'generating_lesson'];
                                    const currentIdx = phases.indexOf(phase);
                                    const isActive = phase === p;
                                    const isDone = currentIdx > i || phase === 'complete';

                                    return (
                                        <div key={p} className="flex items-center gap-3">
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
                                                {PHASE_LABELS[p]}
                                            </span>
                                        </div>
                                    );
                                }
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
}
