import Anthropic from '@anthropic-ai/sdk';
import type { GeminiVideoAnalysis } from '@/types/analysis';
import type { GeneratedLesson, BloomsLevel } from '@/types/lessons';

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
});

interface LessonGenerationOptions {
    duration?: number; // Target lesson duration in minutes
    audience?: string; // Target audience level
    template?: 'iata' | 'custom';
    focusAreas?: string[]; // Specific topics to emphasize
}

export class ClaudeLessonService {
    /**
     * Generate a complete lesson plan from Gemini analysis
     */
    async generateLessonFromAnalysis(
        analysis: GeminiVideoAnalysis | any,
        options: LessonGenerationOptions = {}
    ): Promise<GeneratedLesson> {
        const {
            duration = 60,
            audience = 'intermediate',
            template = 'iata',
            focusAreas = [],
        } = options;

        try {
            const prompt = this.buildLessonPrompt(analysis, duration, audience, template, focusAreas);

            const message = await anthropic.messages.create({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 8000,
                temperature: 0.7,
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
            });

            const responseText = message.content[0].type === 'text'
                ? message.content[0].text
                : '';

            const lessonPlan = this.parseLessonPlan(responseText);

            return lessonPlan;
        } catch (error) {
            console.error('Claude lesson generation error:', error);
            throw new Error(`Lesson generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Build comprehensive lesson generation prompt
     */
    private buildLessonPrompt(
        analysis: any,
        duration: number,
        audience: string,
        template: string,
        focusAreas: string[]
    ): string {
        const focusInstruction = focusAreas.length > 0
            ? `\nPay special attention to these topics: ${focusAreas.join(', ')}`
            : '';

        return `You are an expert instructional designer creating professional aviation training lesson plans following IATA standards.

SOURCE CONTENT ANALYSIS:
${JSON.stringify(analysis, null, 2)}

LESSON REQUIREMENTS:
- Duration: ${duration} minutes
- Audience: ${audience} level
- Template: ${template.toUpperCase()} format
- Focus: Evidence-based instructional design${focusInstruction}

TASK: Generate a complete, professional lesson plan in JSON format.

STRUCTURE REQUIRED:
{
  "module": {
    "module_number": 1,
    "title": "Engaging, specific module title",
    "duration_minutes": ${duration},
    "rationale": "2-3 sentences explaining why this content matters to learners (answer 'What's in it for me?')"
  },
  "objectives": [
    {
      "objective_type": "terminal",
      "content": "By the end of this module, learners will be able to [specific, measurable action]",
      "blooms_level": "apply",
      "order_num": 1
    },
    {
      "objective_type": "enabling",
      "content": "Specific sub-objective that supports the terminal objective",
      "blooms_level": "understand",
      "order_num": 2
    }
  ],
  "activities": [
    {
      "learning_objective_id": 1, // Links to objective order_num
      "instruction_method": "lecture | discussion | simulation | case_study | hands_on | role_play | demonstration",
      "description": "Detailed description of the activity and what learners do",
      "duration_minutes": 15,
      "materials": "List of required materials, resources, or equipment",
      "order_num": 1
    }
  ]
}

CRITICAL REQUIREMENTS:
1. **Terminal Objective**: ONE clear, measurable outcome for the entire module (Bloom's: Apply or higher)
2. **Enabling Objectives**: 3-5 supporting objectives that build toward the terminal objective
3. **Learning Activities**: Each activity must:
   - Link to a specific objective
   - Use varied instruction methods
   - Be time-realistic
   - Include specific, actionable steps
   - Follow adult learning principles (active, relevant, practical)
4. **Time Allocation**: 
   - Activities must sum to ${duration} minutes
   - Allow for introduction (~10%) and wrap-up (~10%)
5. **IATA Compliance**:
   - Professional aviation training standards
   - Safety-first mindset
   - Competency-based approach
6. **Bloom's Taxonomy**: Use appropriate levels:
   - Remember, Understand (foundation)
   - Apply, Analyze (practical)
   - Evaluate, Create (advanced)

INSTRUCTION METHODS GUIDE:
- Lecture: Efficient for new concepts (max 15 min blocks)
- Discussion: Build on experience, generate ideas
- Hands-on: Practice procedures, build skills
- Case Study: Analyze real scenarios
- Simulation: Practice decision-making safely
- Role Play: Practice interpersonal skills
- Demonstration: Show correct procedures

Return ONLY valid JSON. No markdown, no explanations.`;
    }

    /**
     * Parse Claude's response into structured lesson plan
     */
    private parseLessonPlan(responseText: string): GeneratedLesson {
        let jsonText = responseText.trim();

        // Remove markdown if present
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
        }

        try {
            const parsed = JSON.parse(jsonText);

            // Validate structure
            this.validateLessonPlan(parsed);

            return parsed as GeneratedLesson;
        } catch (error) {
            console.error('Failed to parse lesson plan:', responseText);
            throw new Error('Invalid lesson plan JSON from Claude');
        }
    }

    /**
     * Validate lesson plan structure
     */
    private validateLessonPlan(plan: any): void {
        if (!plan.module || !plan.objectives || !plan.activities) {
            throw new Error('Lesson plan missing required sections');
        }

        if (!Array.isArray(plan.objectives) || plan.objectives.length === 0) {
            throw new Error('Lesson plan must have at least one objective');
        }

        if (!Array.isArray(plan.activities) || plan.activities.length === 0) {
            throw new Error('Lesson plan must have at least one activity');
        }

        // Validate terminal objective exists
        const hasTerminal = plan.objectives.some((obj: any) => obj.objective_type === 'terminal');
        if (!hasTerminal) {
            throw new Error('Lesson plan must have at least one terminal objective');
        }
    }

    /**
     * Enhance an existing lesson plan
     */
    async enhanceLesson(
        existingLesson: GeneratedLesson,
        enhancementRequest: string
    ): Promise<GeneratedLesson> {
        const prompt = `You are improving an existing lesson plan.

CURRENT LESSON PLAN:
${JSON.stringify(existingLesson, null, 2)}

ENHANCEMENT REQUEST:
${enhancementRequest}

Return the COMPLETE enhanced lesson plan in the same JSON structure, incorporating the requested improvements.

Maintain:
- IATA compliance
- Professional standards
- Bloom's taxonomy alignment
- Time realism

Return ONLY valid JSON.`;

        const message = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 8000,
            messages: [{ role: 'user', content: prompt }],
        });

        const responseText = message.content[0].type === 'text'
            ? message.content[0].text
            : '';

        return this.parseLessonPlan(responseText);
    }
}

export const claudeLessonService = new ClaudeLessonService();