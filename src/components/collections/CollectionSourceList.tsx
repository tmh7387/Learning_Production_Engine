'use client';

import React from 'react';

interface CollectionSource {
    id: string;
    source_id: string;
    order_index: number;
    sources: {
        id: string;
        title: string;
        source_type: string;
        status: string;
    };
}

interface CollectionSourceListProps {
    sources: CollectionSource[];
    onRemove?: (sourceId: string) => void;
}

const SOURCE_TYPE_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
    youtube: {
        icon: '▶',
        color: 'text-red-600',
        bg: 'bg-red-50',
    },
    pdf: {
        icon: '📄',
        color: 'text-blue-600',
        bg: 'bg-blue-50',
    },
    pptx: {
        icon: '📊',
        color: 'text-orange-600',
        bg: 'bg-orange-50',
    },
};

const STATUS_BADGES: Record<string, { label: string; classes: string }> = {
    processing: {
        label: 'Analyzing...',
        classes: 'bg-amber-100 text-amber-700',
    },
    completed: {
        label: 'Ready',
        classes: 'bg-green-100 text-green-700',
    },
    failed: {
        label: 'Failed',
        classes: 'bg-red-100 text-red-700',
    },
};

export function CollectionSourceList({ sources, onRemove }: CollectionSourceListProps) {
    if (sources.length === 0) {
        return (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
                <div className="text-3xl mb-2">📚</div>
                <p className="text-sm text-gray-500">No sources yet</p>
                <p className="text-xs text-gray-400 mt-1">Add YouTube videos, PDFs, or PowerPoints</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {sources
                .sort((a, b) => a.order_index - b.order_index)
                .map((cs, idx) => {
                    const typeInfo = SOURCE_TYPE_ICONS[cs.sources.source_type] || {
                        icon: '📁',
                        color: 'text-gray-600',
                        bg: 'bg-gray-50',
                    };
                    const statusInfo = STATUS_BADGES[cs.sources.status] || STATUS_BADGES.processing;

                    return (
                        <div
                            key={cs.id}
                            className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-primary-100 hover:shadow-sm transition-all duration-200 group"
                        >
                            {/* Order number */}
                            <span className="flex-shrink-0 h-6 w-6 rounded-full bg-gray-100 text-gray-500 text-xs font-medium flex items-center justify-center">
                                {idx + 1}
                            </span>

                            {/* Type icon */}
                            <div className={`flex-shrink-0 h-9 w-9 rounded-lg ${typeInfo.bg} flex items-center justify-center`}>
                                <span className={`text-sm ${typeInfo.color}`}>{typeInfo.icon}</span>
                            </div>

                            {/* Title & type */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                    {cs.sources.title || `Source ${idx + 1}`}
                                </p>
                                <p className="text-xs text-gray-400 capitalize">
                                    {cs.sources.source_type}
                                </p>
                            </div>

                            {/* Status badge */}
                            <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.classes}`}>
                                {cs.sources.status === 'processing' && (
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse mr-1.5" />
                                )}
                                {statusInfo.label}
                            </span>

                            {/* Remove button */}
                            {onRemove && (
                                <button
                                    onClick={() => onRemove(cs.source_id)}
                                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
                                    title="Remove source"
                                >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    );
                })}
        </div>
    );
}
