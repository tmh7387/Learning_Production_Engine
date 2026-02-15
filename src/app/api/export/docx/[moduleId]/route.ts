import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
} from 'docx';

export async function GET(
    request: NextRequest,
    { params }: { params: { moduleId: string } }
) {
    try {
        const supabase = createServerComponentClient({ cookies });
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { moduleId } = params;

        // Fetch module with its course
        const { data: module, error: modError } = await supabase
            .from('modules')
            .select('*, courses(*)')
            .eq('id', moduleId)
            .single();

        if (modError || !module) {
            return NextResponse.json({ error: 'Module not found' }, { status: 404 });
        }

        // Fetch objectives with activities
        const { data: objectives } = await supabase
            .from('learning_objectives')
            .select('*, learning_activities(*)')
            .eq('module_id', moduleId)
            .order('order_index');

        // Build DOCX document
        const doc = generateIATADocument(module, objectives || []);
        const buffer = await Packer.toBuffer(doc);
        const uint8Array = new Uint8Array(buffer);

        // Return as downloadable file
        const fileName = `${module.title.replace(/[^a-zA-Z0-9]/g, '_')}_Lesson_Plan.docx`;

        return new NextResponse(uint8Array, {
            headers: {
                'Content-Type':
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="${fileName}"`,
            },
        });
    } catch (error) {
        console.error('Export error:', error);
        return NextResponse.json(
            { error: 'Export failed', details: error instanceof Error ? error.message : 'Unknown' },
            { status: 500 }
        );
    }
}

function generateIATADocument(
    module: Record<string, unknown>,
    objectives: Array<Record<string, unknown>>
): Document {
    const sections: Paragraph[] = [];

    // Title page
    sections.push(
        new Paragraph({
            text: (module.courses as Record<string, unknown>)?.title as string || 'Lesson Plan',
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
        }),
        new Paragraph({
            text: `Module ${module.module_number}: ${module.title}`,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
        })
    );

    // Module details
    if (module.description) {
        sections.push(
            new Paragraph({
                text: 'Module Description',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200 },
            }),
            new Paragraph({
                text: module.description as string,
                spacing: { after: 200 },
            })
        );
    }

    if (module.duration) {
        sections.push(
            new Paragraph({
                children: [
                    new TextRun({ text: 'Duration: ', bold: true }),
                    new TextRun({ text: module.duration as string }),
                ],
                spacing: { after: 200 },
            })
        );
    }

    // Objectives and Activities
    const terminalObjs = objectives.filter(
        (o) => o.objective_type === 'terminal'
    );
    const enablingObjs = objectives.filter(
        (o) => o.objective_type === 'enabling'
    );

    if (terminalObjs.length > 0) {
        sections.push(
            new Paragraph({
                text: 'Terminal Learning Objectives',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 300 },
            })
        );

        terminalObjs.forEach((obj, idx) => {
            sections.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `TLO ${idx + 1}: `,
                            bold: true,
                        }),
                        new TextRun({ text: obj.content as string }),
                    ],
                    spacing: { after: 100 },
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `Bloom's Level: `,
                            bold: true,
                            italics: true,
                            size: 20,
                        }),
                        new TextRun({
                            text: (obj.blooms_level as string || '').toUpperCase(),
                            italics: true,
                            size: 20,
                        }),
                    ],
                    spacing: { after: 100 },
                })
            );

            // Activities for this objective
            const activities = obj.learning_activities as Array<Record<string, unknown>> || [];
            activities.forEach((act, actIdx) => {
                sections.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `  Activity ${actIdx + 1}: `,
                                bold: true,
                                size: 20,
                            }),
                            new TextRun({
                                text: `[${act.instruction_method}] ${act.description}`,
                                size: 20,
                            }),
                        ],
                        indent: { left: 720 },
                        spacing: { after: 50 },
                    })
                );
                if (act.duration) {
                    sections.push(
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: `Duration: ${act.duration} | Resources: ${act.resources || 'N/A'}`,
                                    italics: true,
                                    size: 18,
                                }),
                            ],
                            indent: { left: 1080 },
                            spacing: { after: 100 },
                        })
                    );
                }
            });
        });
    }

    if (enablingObjs.length > 0) {
        sections.push(
            new Paragraph({
                text: 'Enabling Learning Objectives',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 300 },
            })
        );

        enablingObjs.forEach((obj, idx) => {
            sections.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: `ELO ${idx + 1}: `, bold: true }),
                        new TextRun({ text: obj.content as string }),
                    ],
                    spacing: { after: 100 },
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `Bloom's Level: `,
                            bold: true,
                            italics: true,
                            size: 20,
                        }),
                        new TextRun({
                            text: (obj.blooms_level as string || '').toUpperCase(),
                            italics: true,
                            size: 20,
                        }),
                    ],
                    spacing: { after: 100 },
                })
            );

            const activities = obj.learning_activities as Array<Record<string, unknown>> || [];
            activities.forEach((act, actIdx) => {
                sections.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `  Activity ${actIdx + 1}: `,
                                bold: true,
                                size: 20,
                            }),
                            new TextRun({
                                text: `[${act.instruction_method}] ${act.description}`,
                                size: 20,
                            }),
                        ],
                        indent: { left: 720 },
                        spacing: { after: 50 },
                    })
                );
            });
        });
    }

    // Footer
    sections.push(
        new Paragraph({
            text: '',
            spacing: { before: 400 },
        }),
        new Paragraph({
            children: [
                new TextRun({
                    text: `Generated by Learning Production Engine | ${new Date().toLocaleDateString()}`,
                    italics: true,
                    size: 18,
                    color: '888888',
                }),
            ],
            alignment: AlignmentType.CENTER,
        })
    );

    return new Document({
        sections: [
            {
                children: sections,
            },
        ],
    });
}
