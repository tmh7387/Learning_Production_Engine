export type BloomsLevel =
    | 'remember'
    | 'understand'
    | 'apply'
    | 'analyze'
    | 'evaluate'
    | 'create';

export type ObjectiveType = 'terminal' | 'enabling';

export interface Course {
    id: string;
    organizationId: string;
    title: string;
    description: string | null;
    status: 'draft' | 'published' | 'archived';
    createdAt: string;
    updatedAt: string;
}

export interface Module {
    id: string;
    courseId: string;
    moduleNumber: number;
    title: string;
    description: string | null;
    duration: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface LearningObjective {
    id: string;
    moduleId: string;
    objectiveType: ObjectiveType;
    content: string;
    bloomsLevel: BloomsLevel;
    orderIndex: number;
}

export interface LearningActivity {
    id: string;
    learningObjectiveId: string;
    instructionMethod: string;
    description: string;
    duration: string | null;
    resources: string | null;
    orderIndex: number;
}

export interface GeneratedLesson {
    course: {
        title: string;
        description: string;
    };
    modules: Array<{
        moduleNumber: number;
        title: string;
        description: string;
        duration: string;
        objectives: Array<{
            type: ObjectiveType;
            content: string;
            bloomsLevel: BloomsLevel;
            activities: Array<{
                instructionMethod: string;
                description: string;
                duration: string;
                resources: string;
            }>;
        }>;
    }>;
}
