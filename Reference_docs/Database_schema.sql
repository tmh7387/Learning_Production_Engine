-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- CORE TABLES (Multi-tenant structure)
-- ============================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

-- ============================================
-- SOURCE MANAGEMENT (New approach)
-- ============================================

CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('youtube', 'pdf', 'pptx', 'url')),
  source_url TEXT,
  title TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sources_org_status ON sources(organization_id, status);
CREATE INDEX idx_sources_type ON sources(source_type);

-- ============================================
-- AI ANALYSIS RESULTS (Cached)
-- ============================================

CREATE TABLE source_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('gemini_video', 'gemini_document', 'gemini_general')),
  analysis_data JSONB NOT NULL,
  -- Structure: {summary, keyTopics[], transcript, structuralElements[], teachingOpportunities[]}
  processing_time_ms INTEGER,
  cost_usd DECIMAL(10, 6),
  model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analyses_source ON source_analyses(source_id);

-- ============================================
-- KNOWLEDGE CHUNKS (Searchable)
-- ============================================

CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_type TEXT CHECK (chunk_type IN ('concept', 'procedure', 'example', 'code', 'diagram', 'assessment')),
  timestamp_seconds INTEGER, -- For video sources
  metadata JSONB DEFAULT '{}'::jsonb,
  embedding VECTOR(768), -- Gemini embedding dimension
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chunks_source ON knowledge_chunks(source_id);
CREATE INDEX idx_chunks_embedding ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops);

-- ============================================
-- LESSON PLAN STRUCTURE
-- ============================================

CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  code TEXT,
  description TEXT,
  version TEXT DEFAULT '1.0',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  module_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  duration_minutes INTEGER,
  rationale TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, module_number)
);

CREATE TABLE learning_objectives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
  objective_type TEXT CHECK (objective_type IN ('terminal', 'enabling')),
  content TEXT NOT NULL,
  blooms_level TEXT CHECK (blooms_level IN ('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create')),
  order_num INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE learning_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  learning_objective_id UUID REFERENCES learning_objectives(id) ON DELETE CASCADE,
  instruction_method TEXT NOT NULL, -- lecture, discussion, simulation, case_study, etc.
  description TEXT NOT NULL,
  duration_minutes INTEGER,
  materials TEXT,
  order_num INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SOURCE → LESSON LINKAGE
-- ============================================

CREATE TABLE lesson_source_mappings (
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
  source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
  contribution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (module_id, source_id)
);

-- ============================================
-- RLS POLICIES (Security)
-- ============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;

-- Organization members can view their organization's data
CREATE POLICY "org_members_select_sources" ON sources
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org_members_select_courses" ON courses
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  );

-- Similar policies for INSERT, UPDATE, DELETE...

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function for semantic search using embeddings
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5,
  source_filter UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  source_id UUID,
  content TEXT,
  chunk_type TEXT,
  similarity FLOAT
)
LANGUAGE SQL
AS $$
  SELECT
    id,
    source_id,
    content,
    chunk_type,
    1 - (embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks
  WHERE 
    (source_filter IS NULL OR source_id = source_filter)
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sources_updated_at
  BEFORE UPDATE ON sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_modules_updated_at
  BEFORE UPDATE ON modules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();