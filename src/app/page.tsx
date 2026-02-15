'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { SourceInput } from '@/components/sources/SourceInput';

export default function HomePage() {
    const router = useRouter();

    const handleLessonGenerated = (courseId: string) => {
        router.push(`/courses/${courseId}`);
    };

    return (
        <div className="min-h-screen">
            {/* Navigation */}
            <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                            <span className="text-white font-bold text-sm">LP</span>
                        </div>
                        <span className="font-semibold text-gray-900">
                            Learning Production Engine
                        </span>
                    </div>
                    <a
                        href="/auth/login"
                        className="text-sm text-gray-600 hover:text-primary-600 transition-colors"
                    >
                        Sign In
                    </a>
                </div>
            </nav>

            {/* Hero */}
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-indigo-50" />
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
                    <div className="text-center max-w-3xl mx-auto">
                        <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-700 text-xs font-semibold px-3 py-1 rounded-full mb-6">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary-500 animate-pulse" />
                            IATA-Compliant Lesson Plans
                        </div>
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight">
                            Transform any source into{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-indigo-600">
                                professional lesson plans
                            </span>
                        </h1>
                        <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto">
                            Upload a YouTube video, PDF, or PowerPoint — our AI analyzes the
                            content and generates structured, IATA-compliant lesson plans in
                            under 5 minutes.
                        </p>
                        <div className="mt-10">
                            <SourceInput onLessonGenerated={handleLessonGenerated} />
                        </div>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
                <div className="grid md:grid-cols-3 gap-8">
                    {[
                        {
                            title: 'AI-Powered Analysis',
                            description:
                                'Gemini AI analyzes videos and documents to extract key concepts, teaching opportunities, and learning outcomes.',
                            icon: (
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                                />
                            ),
                        },
                        {
                            title: 'IATA Compliant',
                            description:
                                'Lesson plans follow IATA AHM Chapter 12 standards with Bloom\'s Taxonomy alignment, terminal and enabling objectives.',
                            icon: (
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                                />
                            ),
                        },
                        {
                            title: 'Fully Editable',
                            description:
                                'Edit every aspect of the generated lesson plan — objectives, activities, durations — then export to DOCX.',
                            icon: (
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                                />
                            ),
                        },
                    ].map((feature, idx) => (
                        <div
                            key={idx}
                            className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm hover:shadow-lg hover:border-primary-100 transition-all duration-300"
                        >
                            <div className="h-12 w-12 rounded-xl bg-primary-50 flex items-center justify-center mb-5">
                                <svg
                                    className="h-6 w-6 text-primary-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    {feature.icon}
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                {feature.title}
                            </h3>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-gray-100 py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-400">
                    Learning Production Engine © {new Date().getFullYear()}
                </div>
            </footer>
        </div>
    );
}
