'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { PencilIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/shared/Button';
import type { Module, LearningObjective, LearningActivity } from '@/types';

interface LessonEditorProps {
    moduleId: string;
}

export function LessonEditor({ moduleId }: LessonEditorProps) {
    const supabase = createClientComponentClient();

    const [module, setModule] = useState<Module | null>(null);
    const [objectives, setObjectives] = useState<LearningObjective[]>([]);
    const [activities, setActivities] = useState<LearningActivity[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadLessonData();
    }, [moduleId]);

    const loadLessonData = async () => {
        try {
            // Load module
            const { data: moduleData, error: moduleError } = await supabase
                .from('modules')
                .select('*')
                .eq('id', moduleId)
                .single();

            if (moduleError) throw moduleError;
            setModule(moduleData);

            // Load objectives
            const { data: objectivesData, error: objectivesError } = await supabase
                .from('learning_objectives')
                .select('*')
                .eq('module_id', moduleId)
                .order('order_num');

            if (objectivesError) throw objectivesError;
            setObjectives(objectivesData || []);

            // Load activities
            const { data: activitiesData, error: activitiesError } = await supabase
                .from('learning_activities')
                .select('*')
                .in('learning_objective_id', objectivesData?.map(o => o.id) || [])
                .order('order_num');

            if (activitiesError) throw activitiesError;
            setActivities(activitiesData || []);

        } catch (error) {
            console.error('Error loading lesson:', error);
            toast.error('Failed to load lesson data');
        } finally {
            setIsLoading(false);
        }
    };

    const handleModuleUpdate = async (field: string, value: any) => {
        try {
            const { error } = await supabase
                .from('modules')
                .update({ [field]: value })
                .eq('id', moduleId);

            if (error) throw error;

            setModule(prev => prev ? { ...prev, [field]: value } : null);
            toast.success('Module updated');
        } catch (error) {
            toast.error('Update failed');
        }
    };

    const handleObjectiveUpdate = async (objectiveId: string, field: string, value: any) => {
        try {
            const { error } = await supabase
                .from('learning_objectives')
                .update({ [field]: value })
                .eq('id', objectiveId);

            if (error) throw error;

            setObjectives(prev =>
                prev.map(obj => obj.id === objectiveId ? { ...obj, [field]: value } : obj)
            );
            toast.success('Objective updated');
        } catch (error) {
            toast.error('Update failed');
        }
    };

    const handleActivityUpdate = async (activityId: string, field: string, value: any) => {
        try {
            const { error } = await supabase
                .from('learning_activities')
                .update({ [field]: value })
                .eq('id', activityId);

            if (error) throw error;

            setActivities(prev =>
                prev.map(act => act.id === activityId ? { ...act, [field]: value } : act)
            );
            toast.success('Activity updated');
        } catch (error) {
            toast.error('Update failed');
        }
    };

    const handleExport = async () => {
        try {
            const response = await fetch(`/api/export/docx/${moduleId}`);

            if (!response.ok) throw new Error('Export failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${module?.title || 'lesson'}_plan.docx`;
            a.click();
            window.URL.revokeObjectURL(url);

            toast.success('Lesson plan exported');
        } catch (error) {
            toast.error('Export failed');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!module) {
        return <div>Module not found</div>;
    }

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-8">
            {/* Module Header */}
            <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                        <input
                            type="text"
                            value={module.title}
                            onChange={(e) => handleModuleUpdate('title', e.target.value)}
                            className="text-2xl font-bold w-full border-0 focus:ring-2 focus:ring-indigo-500 rounded px-2"
                        />
                        <div className="flex gap-4 mt-2 text-sm text-gray-600">
                            <span>Module #{module.module_number}</span>
                            <span>Duration: {module.duration_minutes} minutes</span>
                        </div>
                    </div>
                    <Button onClick={handleExport} variant="secondary">
                        Export to Word
                    </Button>
                </div>

                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Module Rationale
                    </label>
                    <textarea
                        value={module.rationale || ''}
                        onChange={(e) => handleModuleUpdate('rationale', e.target.value)}
                        rows={3}
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Why is this module important for learners?"
                    />
                </div>
            </div>

            {/* Learning Objectives */}
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4">Learning Objectives</h2>

                <div className="space-y-4">
                    {objectives.map((objective) => (
                        <div key={objective.id} className="border-l-4 border-indigo-600 pl-4 py-2">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded ${objective.objective_type === 'terminal'
                                                ? 'bg-purple-100 text-purple-800'
                                                : 'bg-blue-100 text-blue-800'
                                            }`}>
                                            {objective.objective_type}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            Bloom's: {objective.blooms_level}
                                        </span>
                                    </div>
                                    <textarea
                                        value={objective.content}
                                        onChange={(e) => handleObjectiveUpdate(objective.id, 'content', e.target.value)}
                                        rows={2}
                                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Activities for this objective */}
                            <div className="mt-4 ml-4 space-y-2">
                                {activities
                                    .filter(act => act.learning_objective_id === objective.id)
                                    .map((activity) => (
                                        <div key={activity.id} className="bg-gray-50 p-3 rounded">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-sm font-medium text-indigo-600">
                                                    {activity.instruction_method}
                                                </span>
                                                <span className="text-sm text-gray-500">
                                                    {activity.duration_minutes} min
                                                </span>
                                            </div>
                                            <textarea
                                                value={activity.description}
                                                onChange={(e) => handleActivityUpdate(activity.id, 'description', e.target.value)}
                                                rows={2}
                                                className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                            />
                                            {activity.materials && (
                                                <div className="mt-2 text-sm text-gray-600">
                                                    <strong>Materials:</strong> {activity.materials}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}