'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { LessonEditor } from '@/components/lessons/LessonEditor';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/shared/Button';
import Link from 'next/link';

interface CourseData {
    id: string;
    title: string;
    description: string | null;
    status: string;
}

interface ModuleData {
    id: string;
    title: string;
    module_number: number;
}

export default function CoursePage({
    params,
}: {
    params: { courseId: string };
}) {
    const [course, setCourse] = useState<CourseData | null>(null);
    const [modules, setModules] = useState<ModuleData[]>([]);
    const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCourse = async () => {
            const supabase = createClient();
            const { data: courseData } = await supabase
                .from('courses')
                .select('*')
                .eq('id', params.courseId)
                .single();

            const { data: moduleData } = await supabase
                .from('modules')
                .select('id, title, module_number')
                .eq('course_id', params.courseId)
                .order('module_number');

            if (courseData) setCourse(courseData);
            if (moduleData && moduleData.length > 0) {
                setModules(moduleData);
                setActiveModuleId(moduleData[0].id);
            }
            setLoading(false);
        };

        fetchCourse();
    }, [params.courseId]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <LoadingSpinner size="lg" message="Loading course..." />
            </div>
        );
    }

    if (!course) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <p className="text-gray-500">Course not found</p>
                <Link href="/">
                    <Button variant="secondary">Go Home</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Nav */}
            <nav className="border-b border-gray-200 bg-white sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/"
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            ← Home
                        </Link>
                        <span className="text-gray-300">|</span>
                        <h1 className="font-semibold text-gray-900 truncate max-w-md">
                            {course.title}
                        </h1>
                    </div>
                    <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${course.status === 'published'
                            ? 'bg-green-100 text-green-700'
                            : course.status === 'archived'
                                ? 'bg-gray-100 text-gray-600'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                    >
                        {course.status}
                    </span>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Module tabs */}
                {modules.length > 1 && (
                    <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
                        {modules.map((mod) => (
                            <button
                                key={mod.id}
                                onClick={() => setActiveModuleId(mod.id)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeModuleId === mod.id
                                    ? 'bg-primary-600 text-white shadow-sm'
                                    : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300'
                                    }`}
                            >
                                Module {mod.module_number}: {mod.title}
                            </button>
                        ))}
                    </div>
                )}

                {/* Editor */}
                {activeModuleId ? (
                    <LessonEditor key={activeModuleId} moduleId={activeModuleId} />
                ) : (
                    <div className="text-center py-16 text-gray-500">
                        No modules found for this course.
                    </div>
                )}
            </div>
        </div>
    );
}
