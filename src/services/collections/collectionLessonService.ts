import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@/lib/supabase/server';
import { config } from '@/lib/config';
import type { GeneratedLesson } from '@/types/lessons';
import type { CrossSourceSynthesis } from '@/types/collections';

export class CollectionLessonService {
    private claude: Anthropic;
    private supabase;

    constructor() {
        this.claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
        this.supabase = createServiceClient();
    }

    /**
     * Generate IATA lesson plan from collection synthesis
     */
    async generateFromCollection(
        collectionId: string,
        synthesis: CrossSourceSynthesis
    ): Promise<GeneratedLesson> {
        // Get collection details and sources
        const { data: collection } = await this.supabase
            .from('source_collections')
            .select(`
        *,
        collection_sources (
          sources (id, title, source_type)
        )
      `)
            .eq('id', collectionId)
            .single();

        if (!collection) {
            throw new Error('Collection not found');
        }

        const prompt = this.buildLessonPrompt(collection, synthesis);

        const message = await this.claude.messages.create({
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

        const lesson: GeneratedLesson = JSON.parse(jsonStr);

        // Add metadata about sources used
        lesson.metadata = {
            collectionId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sourcesUsed: collection.collection_sources.map((cs: any) => cs.sources.id),
            synthesisStrategy: synthesis.synthesisStrategy,
        };

        return lesson;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private buildLessonPrompt(collection: any, synthesis: CrossSourceSynthesis): string {
        const sourcesList = collection.collection_sources
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((cs: any, idx: number) => {
                const contrib = synthesis.sourceContributions[cs.sources.id] || {};
                return `
${idx + 1}. ${cs.sources.title} (${cs.sources.source_type})
   - Unique Topics: ${contrib.uniqueTopics?.join(', ') || 'N/A'}
   - Primary Focus: ${contrib.primaryFocus || 'N/A'}
   - Bloom's Levels: ${contrib.bloomsLevels?.join(', ') || 'N/A'}`;
            })
            .join('\n');

        const themesList = synthesis.unifiedThemes
            .map((theme) => `- ${theme.theme}: ${theme.description}`)
            .join('\n');

        return `You are an expert aviation instructional designer creating IATA-compliant lesson plans.

# Collection: ${collection.title}
${collection.description || ''}

# Sources in Collection (${collection.collection_sources.length})
${sourcesList}

# Cross-Source Synthesis
${JSON.stringify(synthesis, null, 2)}

# Unified Themes
${themesList}

# Task
Create a comprehensive IATA-compliant lesson plan that strategically integrates ALL sources in this collection.

## Requirements
1. Follow IATA Training Standards (AHM Chapter 12)
2. Use Bloom's Taxonomy for objectives
3. Create modules that draw from multiple sources
4. Include source attribution in activities (which source supports this activity)
5. Follow the recommended learning sequence from synthesis
6. Address identified knowledge gaps
7. Build progressive complexity across modules

## Output Format
Respond with ONLY valid JSON:

{
  "course": {
    "title": "Course title from collection theme",
    "description": "2-3 sentence overview synthesizing all sources",
    "course_code": "IATA-style code (e.g., CRM-I-GND-001)",
    "iata_category": "Category (e.g., Ground Operations, Safety, Customer Service)",
    "total_duration_minutes": 180
  },
  "modules": [
    {
      "moduleNumber": 1,
      "title": "Module title",
      "description": "How this module integrates the sources",
      "duration": "60 minutes",
      "objectives": [
        {
          "type": "terminal",
          "content": "Upon completion, the learner will be able to...",
          "bloomsLevel": "apply",
          "sourceIds": ["source-id-1", "source-id-2"],
          "activities": [
            {
              "instructionMethod": "lecture",
              "description": "Activity description with specific source references",
              "duration": "15 minutes",
              "resources": "Source 1: Video demonstration; Source 2: Reference manual",
              "sourceIds": ["source-id-1"]
            }
          ]
        }
      ]
    }
  ]
}

## Strategic Integration Guidelines
- Use video sources for demonstrations and procedures
- Use PDF sources for reference material and standards
- Use PowerPoint sources for conceptual overviews
- Combine sources for comprehensive coverage
- Create activities that require cross-referencing sources
- Build knowledge progression following synthesis sequence

Return ONLY the JSON.`;
    }
}

export const collectionLessonService = new CollectionLessonService();
