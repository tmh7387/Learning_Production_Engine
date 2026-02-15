export type ObjectiveType = 'terminal' | 'enabling';
export type BloomsLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
export type CourseStatus = 'draft' | 'review' | 'published' | 'archived';

export interface Course {
    id: string;
    organization_id: string;
    title: string;
    code: string | null;
    description: string | null;
    version: string;
    status: CourseStatus;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface Module {
    id: string;
    course_id: string;
    module_number: number;
    title: string;
    duration_minutes: number | null;
    rationale: string | null;
    created_at: string;
    updated_at: string;
}

export interface LearningObjective {
    id: string;
    module_id: string;
    objective_type: ObjectiveType;
    content: string;
    blooms_level: BloomsLevel | null;
    order_num: number;
    created_at: string;
}

export interface LearningActivity {
    id: string;
    learning_objective_id: string;
    instruction_method: string;
    description: string;
    duration_minutes: number | null;
    materials: string | null;
    order_num: number;
    created_at: string;
}

export interface GeneratedLesson {
    module: Omit<Module, 'id' | 'course_id' | 'created_at' | 'updated_at'>;
    objectives: Array<Omit<LearningObjective, 'id' | 'module_id' | 'created_at'>>;
    activities: Array<Omit<LearningActivity, 'id' | 'learning_objective_id' | 'created_at'>>;
}