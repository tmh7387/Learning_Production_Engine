'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { SourceInput } from '@/components/sources/SourceInput';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function HomePage() {
    const router = useRouter();
    const supabase = createClientComponentClient();

    const handleSourceAdded = (result: { courseId: string; moduleId: string }) => {
        router.push(`/courses/${result.courseId}`);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <h1 className="text-2xl font-bold text-gray-900">
                        Learning Production Engine
                    </h1>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white rounded-lg shadow-lg p-8">
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">
                            Transform Any Source into Professional Lesson Plans
                        </h2>
                        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                            Upload a YouTube video, PDF, or PowerPoint, and our AI will generate
                            a complete IATA-compliant lesson plan in minutes.
                        </p>
                    </div>

                    <div className="flex justify-center">
                        <SourceInput onSourceAdded={handleSourceAdded} />
                    </div>

                    {/* Features */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                        <div className="text-center">
                            <div className="bg-indigo-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <h3 className="font-semibold text-lg mb-2">AI-Powered Analysis</h3>
                            <p className="text-gray-600">
                                Gemini and Claude work together to extract teaching opportunities
                            </p>
                        </div>

                        <div className="text-center">
                            <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="font-semibold text-lg mb-2">IATA Compliant</h3>
                            <p className="text-gray-600">
                                Professional aviation training standards built-in
                            </p>
                        </div>

                        <div className="text-center">
                            <div className="bg-purple-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </div>
                            <h3 className="font-semibold text-lg mb-2">Fully Editable</h3>
                            <p className="text-gray-600">
                                Refine and customize every detail before export
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}