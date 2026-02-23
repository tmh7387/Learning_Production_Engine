import { createServiceClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '@/lib/config';
import type { CollectionAnalysis, CrossSourceSynthesis } from '@/types/collections';
import type { SourceAnalysis } from '@/types/analysis';

export class CollectionAnalyzer {
    private supabase;
    private claude: Anthropic;

    constructor() {
        this.supabase = createServiceClient();
        this.claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    }

    /**
     * Analyze a collection of sources and synthesize cross-source insights
     */
    async analyzeCollection(collectionId: string): Promise<CollectionAnalysis> {
        const startTime = Date.now();

        try {
            // 1. Fetch collection and all its sources
            const { data: collection } = await this.supabase
                .from('source_collections')
                .select(`
          *,
          collection_sources (
            source_id,
            order_index,
            sources (*)
          )
        `)
                .eq('id', collectionId)
                .single();

            if (!collection || !collection.collection_sources) {
                throw new Error('Collection not found');
            }

            // 2. Ensure all sources have individual analyses
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sources = collection.collection_sources.map((cs: any) => cs.sources);
            const analyses = await this.ensureSourceAnalyses(sources);

            // 3. Synthesize across all analyses
            const synthesis = await this.synthesizeAcrossAnalyses(analyses, sources);

            // 4. Calculate cost and save
            const processingTime = Date.now() - startTime;
            const cost = this.estimateCost(analyses.length, JSON.stringify(synthesis).length);

            const { data: savedAnalysis, error } = await this.supabase
                .from('collection_analyses')
                .insert({
                    collection_id: collectionId,
                    analysis_type: 'cross_source_synthesis',
                    analysis_data: synthesis,
                    sources_analyzed: analyses.length,
                    processing_time_ms: processingTime,
                    cost_usd: cost,
                    model_used: config.claude.model,
                })
                .select()
                .single();

            if (error) throw error;

            // 5. Update collection status
            await this.supabase
                .from('source_collections')
                .update({
                    status: 'ready',
                    analysis_completed_at: new Date().toISOString(),
                })
                .eq('id', collectionId);

            return savedAnalysis;
        } catch (error) {
            // Mark collection as failed
            await this.supabase
                .from('source_collections')
                .update({ status: 'failed' })
                .eq('id', collectionId);

            throw error;
        }
    }

    /**
     * Ensure all sources in collection have analyses
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async ensureSourceAnalyses(sources: any[]): Promise<SourceAnalysis[]> {
        const analyses: SourceAnalysis[] = [];

        for (const source of sources) {
            // Check if analysis exists
            const { data: existingAnalysis } = await this.supabase
                .from('source_analyses')
                .select('*')
                .eq('source_id', source.id)
                .single();

            if (existingAnalysis) {
                analyses.push({
                    sourceId: source.id,
                    analysisData: existingAnalysis.analysis_data,
                    processingTime: existingAnalysis.processing_time,
                    cost: parseFloat(existingAnalysis.cost),
                    modelUsed: existingAnalysis.model_used,
                });
            } else {
                // Analysis missing — this shouldn't happen but handle gracefully
                console.warn(`Source ${source.id} missing analysis, skipping`);
            }
        }

        return analyses;
    }

    /**
     * Use Claude to synthesize insights across multiple source analyses
     */
    private async synthesizeAcrossAnalyses(
        analyses: SourceAnalysis[],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sources: any[]
    ): Promise<CrossSourceSynthesis> {
        const prompt = this.buildSynthesisPrompt(analyses, sources);

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

        return JSON.parse(jsonStr);
    }

    /**
     * Build comprehensive synthesis prompt
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private buildSynthesisPrompt(analyses: SourceAnalysis[], sources: any[]): string {
        const sourceSummaries = analyses
            .map((analysis, idx) => {
                const source = sources[idx];
                return `
## Source ${idx + 1}: ${source.title}
Type: ${source.source_type}
Analysis:
${JSON.stringify(analysis.analysisData, null, 2)}
`;
            })
            .join('\n\n');

        return `You are an expert instructional designer synthesizing multiple educational sources into a cohesive learning experience.

# Task
Analyze these ${analyses.length} sources and create a comprehensive cross-source synthesis that identifies:
1. Unified themes present across sources
2. Unique contributions of each source
3. Knowledge gaps and prerequisites
4. Recommended learning sequence
5. Overall synthesis strategy

${sourceSummaries}

# Output Format
Respond with ONLY valid JSON matching this exact structure:

{
  "unifiedThemes": [
    {
      "theme": "Main theme name",
      "description": "What this theme covers",
      "sourcesContributing": ["source-id-1", "source-id-2"],
      "importance": "high" | "medium" | "low"
    }
  ],
  
  "sourceContributions": {
    "source-id-1": {
      "uniqueTopics": ["Topic only in this source"],
      "reinforcedTopics": ["Topics that strengthen other sources"],
      "primaryFocus": "What this source is best for",
      "bloomsLevels": ["Primary cognitive levels addressed"]
    }
  },
  
  "knowledgeGaps": [
    {
      "gap": "Missing topic or concept",
      "description": "Why this matters",
      "suggestedContent": "What would fill this gap"
    }
  ],
  
  "recommendedSequence": [
    {
      "step": 1,
      "sourceIds": ["source-id-1"],
      "rationale": "Why start here",
      "estimatedDuration": "30 minutes"
    }
  ],
  
  "synthesisStrategy": "Overall approach to combining these sources into a cohesive learning experience (2-3 sentences)",
  "overallComplexity": "beginner" | "intermediate" | "advanced",
  "prerequisites": ["What learners should know before starting"]
}

# Guidelines
- Focus on IATA aviation training standards
- Consider adult learning principles
- Identify how sources complement each other
- Note any contradictions or conflicts
- Suggest optimal learning path through materials

Return ONLY the JSON, no markdown formatting.`;
    }

    private estimateCost(numSources: number, outputLength: number): number {
        // Rough estimate for Claude 3.5 Sonnet
        const inputTokens = numSources * 2000; // ~2000 tokens per source analysis
        const outputTokens = outputLength / 4; // ~4 chars per token

        const inputCost = (inputTokens / 1_000_000) * 3.0;
        const outputCost = (outputTokens / 1_000_000) * 15.0;

        return Number((inputCost + outputCost).toFixed(6));
    }
}

export const collectionAnalyzer = new CollectionAnalyzer();
