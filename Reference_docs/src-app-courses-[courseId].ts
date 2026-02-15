import React from 'react';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { LessonEditor } from '@/components/lessons/LessonEditor';
import { notFound } from 'next/navigation';

export default async function CoursePage({
    params,
}: {
    params: { courseId: string };
}) {
    const supabase = createServerComponentClient({ cookies });

    // Fetch course with modules
    const { data: course, error } = await supabase
        .from('courses')
        .select(`
      *,
      modules(*)
    `)
        .eq('id', params.courseId)
        .single();

    if (error || !course) {
        notFound();
    }

    const firstModule = course.modules?.[0];

    return (
        <div className= "min-h-screen bg-gray-50" >
        <header className="bg-white shadow-sm" >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4" >
                <div>
                <h1 className="text-2xl font-bold text-gray-900" >
                    { course.title }
                    </h1>
    {
        course.description && (
            <p className="text-gray-600 mt-1" > { course.description } </p>
            )
    }
    </div>
        </div>
        </header>

        < main className = "py-8" >
        {
            firstModule?(
          <LessonEditor moduleId = { firstModule.id } />
        ): (
                    <div className = "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className = "bg-white rounded-lg shadow p-8 text-center">
              <p className = "text-gray-600">No modules found in this course.</p>
                </div>
                </div>
        )
        }
            </main>
            </div>
  );
}