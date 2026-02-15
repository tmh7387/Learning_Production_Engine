import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

export async function GET(
    request: NextRequest,
    { params }: { params: { moduleId: string } }
) {
    try {
        const supabase = createRouteHandlerClient({ cookies });

        // 1. Authenticate
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Fetch module with all related data
        const { data: module, error: moduleError } = await supabase
            .from('modules')
            .select(`
        *,
        course:courses(*),
        learning_objectives(
          *,
          learning_activities(*)
        )
      `)
            .eq('id', params.moduleId)
            .single();

        if (moduleError || !module) {
            return NextResponse.json({ error: 'Module not found' }, { status: 404 });
        }

        // 3. Generate DOCX
        const doc = await this.generateIATADocument(module);

        // 4. Convert to buffer
        const buffer = await Packer.toBuffer(doc);

        // 5. Return file
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="${module.title.replace(/\s+/g, '_')}_Lesson_Plan.docx"`,
            },
        });

    } catch (error) {
        console.error('DOCX export error:', error);
        return NextResponse.json(
            { error: 'Export failed' },
            { status: 500 }
        );
    }
}

async function generateIATADocument(module: any): Promise<Document> {
    const doc = new Document({
        sections: [
            {
                properties: {},
                children: [
                    // Header
                    new Paragraph({
                        text: 'LESSON PLAN',
                        heading: HeadingLevel.HEADING_1,
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 400 },
                    }),

                    // Module Information
                    new Paragraph({
                        text: 'Module Information',
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 400, after: 200 },
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Module #: ', bold: true }),
                            new TextRun(module.module_number.toString()),
                        ],
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Title: ', bold: true }),
                            new TextRun(module.title),
                        ],
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Duration (approx.) in minutes: ', bold: true }),
                            new TextRun(module.duration_minutes?.toString() || 'N/A'),
                        ],
                        spacing: { after: 200 },
                    }),

                    // Module Rationale
                    new Paragraph({
                        text: 'Module Rationale',
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 400, after: 200 },
                    }),
                    new Paragraph({
                        text: module.rationale || '',
                        spacing: { after: 400 },
                    }),

                    // Learning Objectives and Activities
                    new Paragraph({
                        text: 'Learning Objectives and Activities',
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 400, after: 200 },
                    }),

                    // Generate objectives and activities
                    ...this.generateObjectivesAndActivities(module.learning_objectives),
                ],
            },
        ],
    });

    return doc;
}

function generateObjectivesAndActivities(objectives: any[]): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    objectives.forEach((objective) => {
        // Objective
        paragraphs.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: objective.objective_type === 'terminal'
                            ? 'Terminal Learning Objective: '
                            : 'Enabling Learning Objective: ',
                        bold: true,
                    }),
                    new TextRun(objective.content),
                ],
                spacing: { before: 200, after: 100 },
            })
        );

        // Activities for this objective
        if (objective.learning_activities && objective.learning_activities.length > 0) {
            objective.learning_activities.forEach((activity: any) => {
                paragraphs.push(
                    new Paragraph({
                        children: [
                            new TextRun({ text: '    Instruction Method: ', bold: true }),
                            new TextRun(activity.instruction_method),
                        ],
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: '    Description: ', bold: true }),
                            new TextRun(activity.description),
                        ],
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: '    Time (approx.): ', bold: true }),
                            new TextRun(`${activity.duration_minutes || 'N/A'} minutes`),
                        ],
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: '    Materials: ', bold: true }),
                            new TextRun(activity.materials || 'None specified'),
                        ],
                        spacing: { after: 200 },
                    })
                );
            });
        }
    });

    return paragraphs;
}