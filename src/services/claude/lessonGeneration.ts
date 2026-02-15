import Anthropic from '@anthropic-ai/sdk';
import { config } from '@/lib/config';
import { GeneratedLesson } from '@/types/lessons';
import { GeminiVideoAnalysis } from '@/types/analysis';

export class ClaudeLessonService {
    private client: Anthropic;

    constructor() {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
        this.client = new Anthropic({ apiKey });
    }

    /**
     * Generates an IATA-compliant lesson plan from Gemini analysis output.
     */
    async generateLesson(
        analysis: GeminiVideoAnalysis,
        sourceTitle: string
    ): Promise<GeneratedLesson> {
        const prompt = `You are an expert aviation instructional designer specializing in IATA training standards.

Given the following content analysis, create a comprehensive, IATA-compliant lesson plan.

## Source Content Analysis
Title: ${sourceTitle}
Summary: ${analysis.summary}
Main Topics: ${analysis.mainTopics.join(', ')}
Key Concepts: ${JSON.stringify(analysis.keyConceptsAndDefinitions)}
Teaching Opportunities: ${JSON.stringify(analysis.teachingOpportunities)}
Difficulty: ${analysis.estimatedDifficultyLevel}
Prerequisites: ${analysis.prerequisites.join(', ')}

## Requirements
1. Follow IATA Training Standards (AHM Chapter 12 / IGOM Chapter 2)
2. Use Bloom's Taxonomy for learning objectives (remember → create)
3. Each terminal objective must have at least one enabling objective
4. Activities must include instruction method, description, duration, and resources
5. Use varied instruction methods: lecture, demonstration, practice, discussion, simulation, assessment
6. Ensure progressive complexity (lower Bloom's first, then higher)

## Output Format
Respond with ONLY valid JSON matching this structure:

{
  "course": {
    "title": "Course title derived from the content",
    "description": "2-3 sentence course overview"
  },
  "modules": [
    {
      "moduleNumber": 1,
      "title": "Module title",
      "description": "Module description",
      "duration": "Estimated duration (e.g., '2 hours')",
      "objectives": [
        {
          "type": "terminal",
          "content": "Upon completion, the learner will be able to [action verb] [specific task]",
          "bloomsLevel": "apply",
          "activities": [
            {
              "instructionMethod": "lecture",
              "description": "Detailed activity description",
              "duration": "30 minutes",
              "resources": "Required materials/equipment"
            }
          ]
        },
        {
          "type": "enabling",
          "content": "The learner will be able to [action verb] [specific sub-task]",
          "bloomsLevel": "understand",
          "activities": [
            {
              "instructionMethod": "demonstration",
              "description": "Detailed activity description",
              "duration": "15 minutes",
              "resources": "Required materials"
            }
          ]
        }
      ]
    }
  ]
}`;

        const message = await this.client.messages.create({
            model: config.claude.model,
            max_tokens: config.claude.maxTokens,
            messages: [{ role: 'user', content: prompt }],
        });

        const textContent = message.content.find((c) => c.type === 'text');
        if (!textContent || textContent.type !== 'text') {
            throw new Error('No text response from Claude');
        }

        const jsonStr = textContent.text
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();

        try {
            const lesson: GeneratedLesson = JSON.parse(jsonStr);
            this.validateLesson(lesson);
            return lesson;
        } catch (error) {
            throw new Error(
                `Failed to parse lesson plan: ${error instanceof Error ? error.message : 'Invalid JSON'}`
            );
        }
    }

    /**
     * Enhances an existing lesson plan with improvements.
     */
    async enhanceLesson(
        lesson: GeneratedLesson,
        feedback: string
    ): Promise<GeneratedLesson> {
        const prompt = `You are an expert aviation instructional designer. Enhance this lesson plan based on the feedback.

Current Lesson Plan:
${JSON.stringify(lesson, null, 2)}

Feedback:
${feedback}

Respond with the complete enhanced lesson plan as valid JSON in the same format. Only output the JSON.`;

        const message = await this.client.messages.create({
            model: config.claude.model,
            max_tokens: config.claude.maxTokens,
            messages: [{ role: 'user', content: prompt }],
        });

        const textContent = message.content.find((c) => c.type === 'text');
        if (!textContent || textContent.type !== 'text') {
            throw new Error('No text response from Claude');
        }

        const jsonStr = textContent.text
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();

        return JSON.parse(jsonStr);
    }

    private validateLesson(lesson: GeneratedLesson): void {
        if (!lesson.course?.title) throw new Error('Lesson missing course title');
        if (!lesson.modules?.length) throw new Error('Lesson has no modules');

        for (const mod of lesson.modules) {
            if (!mod.objectives?.length) {
                throw new Error(`Module "${mod.title}" has no objectives`);
            }

            const hasTerminal = mod.objectives.some((o) => o.type === 'terminal');
            if (!hasTerminal) {
                throw new Error(`Module "${mod.title}" needs at least one terminal objective`);
            }
        }
    }
}
