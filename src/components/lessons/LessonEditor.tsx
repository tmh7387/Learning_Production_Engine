'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/shared/Button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import toast from 'react-hot-toast';

interface LessonEditorProps {
    moduleId: string;
}

interface Objective {
    id: string;
    objective_type: 'terminal' | 'enabling';
    content: string;
    blooms_level: string;
    order_index: number;
    learning_activities: Activity[];
}

interface Activity {
    id: string;
    instruction_method: string;
    description: string;
    duration: string | null;
    resources: string | null;
    order_index: number;
}

interface ModuleData {
    id: string;
    title: string;
    description: string | null;
    duration: string | null;
    module_number: number;
}

export function LessonEditor({ moduleId }: LessonEditorProps) {
    const [module, setModule] = useState<ModuleData | null>(null);
    const [objectives, setObjectives] = useState<Objective[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);

    const supabase = createClient();

    const fetchData = useCallback(async () => {
        try {
            const { data: mod } = await supabase
                .from('modules')
                .select('*')
                .eq('id', moduleId)
                .single();

            const { data: objs } = await supabase
                .from('learning_objectives')
                .select('*, learning_activities(*)')
                .eq('module_id', moduleId)
                .order('order_index');

            if (mod) setModule(mod);
            if (objs) setObjectives(objs);
        } catch {
            toast.error('Failed to load lesson data');
        } finally {
            setLoading(false);
        }
    }, [moduleId, supabase]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const updateModule = async (field: string, value: string) => {
        setSaving(true);
        const { error } = await supabase
            .from('modules')
            .update({ [field]: value })
            .eq('id', moduleId);

        if (error) {
            toast.error('Failed to save');
        } else {
            setModule((prev) => (prev ? { ...prev, [field]: value } : prev));
        }
        setSaving(false);
    };

    const updateObjective = async (id: string, content: string) => {
        setSaving(true);
        const { error } = await supabase
            .from('learning_objectives')
            .update({ content })
            .eq('id', id);

        if (error) {
            toast.error('Failed to save objective');
        } else {
            setObjectives((prev) =>
                prev.map((o) => (o.id === id ? { ...o, content } : o))
            );
        }
        setSaving(false);
    };

    const updateActivity = async (
        id: string,
        field: string,
        value: string
    ) => {
        setSaving(true);
        const { error } = await supabase
            .from('learning_activities')
            .update({ [field]: value })
            .eq('id', id);

        if (error) {
            toast.error('Failed to save activity');
        } else {
            setObjectives((prev) =>
                prev.map((o) => ({
                    ...o,
                    learning_activities: o.learning_activities.map((a) =>
                        a.id === id ? { ...a, [field]: value } : a
                    ),
                }))
            );
        }
        setSaving(false);
    };

    const exportDocx = async () => {
        setExporting(true);
        try {
            const res = await fetch(`/api/export/docx/${moduleId}`);

            if (!res.ok) throw new Error('Export failed');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${module?.title || 'lesson'}_plan.docx`;
            a.click();
            window.URL.revokeObjectURL(url);

            toast.success('Lesson plan exported!');
        } catch {
            toast.error('Export failed');
        } finally {
            setExporting(false);
        }
    };

    if (loading) {
        return (
            <div className="py-16">
                <LoadingSpinner message="Loading lesson plan..." />
            </div>
        );
    }

    if (!module) {
        return (
            <div className="text-center py-16 text-gray-500">Module not found</div>
        );
    }

    const terminalObjs = objectives.filter((o) => o.objective_type === 'terminal');
    const enablingObjs = objectives.filter((o) => o.objective_type === 'enabling');

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-1 rounded-full">
                            Module {module.module_number}
                        </span>
                        {saving && (
                            <span className="text-xs text-gray-400 animate-pulse">
                                Saving...
                            </span>
                        )}
                    </div>
                    <input
                        className="mt-2 text-2xl font-bold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 p-0 w-full"
                        value={module.title}
                        onChange={(e) => setModule({ ...module, title: e.target.value })}
                        onBlur={(e) => updateModule('title', e.target.value)}
                    />
                </div>
                <Button onClick={exportDocx} loading={exporting} variant="secondary">
                    Export DOCX
                </Button>
            </div>

            {/* Module description */}
            <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                    Description
                </label>
                <textarea
                    className="w-full rounded-lg border-gray-200 text-sm focus:border-primary-500 focus:ring-primary-500 resize-none"
                    rows={3}
                    value={module.description || ''}
                    onChange={(e) =>
                        setModule({ ...module, description: e.target.value })
                    }
                    onBlur={(e) => updateModule('description', e.target.value)}
                />
            </div>

            {/* Duration */}
            {module.duration && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{module.duration}</span>
                </div>
            )}

            {/* Terminal Objectives */}
            {terminalObjs.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        Terminal Learning Objectives
                    </h3>
                    <div className="space-y-4">
                        {terminalObjs.map((obj, idx) => (
                            <ObjectiveCard
                                key={obj.id}
                                objective={obj}
                                index={idx}
                                prefix="TLO"
                                onUpdateObjective={updateObjective}
                                onUpdateActivity={updateActivity}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Enabling Objectives */}
            {enablingObjs.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                        Enabling Learning Objectives
                    </h3>
                    <div className="space-y-4">
                        {enablingObjs.map((obj, idx) => (
                            <ObjectiveCard
                                key={obj.id}
                                objective={obj}
                                index={idx}
                                prefix="ELO"
                                onUpdateObjective={updateObjective}
                                onUpdateActivity={updateActivity}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// Sub-component for rendering an objective and its activities
function ObjectiveCard({
    objective,
    index,
    prefix,
    onUpdateObjective,
    onUpdateActivity,
}: {
    objective: Objective;
    index: number;
    prefix: string;
    onUpdateObjective: (id: string, content: string) => void;
    onUpdateActivity: (id: string, field: string, value: string) => void;
}) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-gray-500">
                            {prefix} {index + 1}
                        </span>
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full capitalize">
                            {objective.blooms_level}
                        </span>
                    </div>
                    <textarea
                        className="w-full text-sm text-gray-800 bg-transparent border-none focus:ring-0 p-0 resize-none"
                        rows={2}
                        value={objective.content}
                        onChange={() => { }}
                        onBlur={(e) => onUpdateObjective(objective.id, e.target.value)}
                        defaultValue={objective.content}
                    />
                </div>
            </div>

            {/* Activities */}
            {objective.learning_activities?.length > 0 && (
                <div className="mt-4 pl-4 border-l-2 border-gray-100 space-y-3">
                    {objective.learning_activities.map((act, actIdx) => (
                        <div
                            key={act.id}
                            className="bg-gray-50 rounded-lg p-3"
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                                    {act.instruction_method}
                                </span>
                                {act.duration && (
                                    <span className="text-xs text-gray-400">{act.duration}</span>
                                )}
                            </div>
                            <textarea
                                className="w-full text-sm text-gray-700 bg-transparent border-none focus:ring-0 p-0 resize-none"
                                rows={2}
                                defaultValue={act.description}
                                onBlur={(e) =>
                                    onUpdateActivity(act.id, 'description', e.target.value)
                                }
                            />
                            {act.resources && (
                                <p className="text-xs text-gray-400 mt-1">
                                    Resources: {act.resources}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
