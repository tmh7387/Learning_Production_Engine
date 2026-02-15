# Learning Production Engine - Phase 1

AI-powered lesson plan generation from YouTube videos, PDFs, and PowerPoint presentations.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Gemini API key
- Anthropic API key

### Installation

1. **Clone and Install**
```bash
git clone <repository-url>
cd learning-production-engine
npm install
```

2. **Environment Setup**
```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:
- Get Supabase keys from: https://supabase.com/dashboard
- Get Gemini key from: https://aistudio.google.com/app/apikey
- Get Anthropic key from: https://console.anthropic.com/

3. **Database Setup**
```bash
# Apply migration
npx supabase db push

# Or manually run the SQL in:
# supabase/migrations/001_initial_schema.sql
```

4. **Create Storage Bucket**

In Supabase Dashboard:
- Go to Storage
- Create bucket: `source-files`
- Set to Public

5. **Run Development Server**
```bash
npm run dev
```

Open http://localhost:3000

## 📖 Usage Guide

### Generate Lesson from YouTube

1. Click "Generate from Source"
2. Select "URL" method
3. Paste YouTube URL
4. Click "Generate Lesson"
5. Wait 3-5 minutes
6. Edit generated lesson
7. Export to Word

### Upload PDF/PowerPoint

1. Click "Generate from Source"
2. Select "Upload File"
3. Choose PDF or PPTX file
4. Wait for processing
5. Review and edit lesson
6. Export

## 🏗️ Project Structure
```
src/
├── app/                    # Next.js app router
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── courses/           # Course pages
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── lessons/           # Lesson editor
│   ├── sources/           # Source input
│   └── shared/            # Reusable UI
├── lib/                   # Utilities
│   └── supabase/          # Supabase clients
├── services/              # Business logic
│   ├── gemini/            # Gemini AI
│   ├── claude/            # Claude AI
│   └── sources/           # Source processing
└── types/                 # TypeScript types
```

## 🔧 Configuration

### AI Models
- **Gemini 1.5 Pro**: Video/document analysis
- **Claude 3.5 Sonnet**: Lesson generation

### Processing Limits
- Max video duration: 60 minutes
- Max file size: 100MB
- Max concurrent analyses: 3

## 📊 Cost Estimates

Per analysis (approximate):
- 10-min YouTube video: $0.50 - $1.00
- 20-page PDF: $0.20 - $0.40
- 30-slide PowerPoint: $0.30 - $0.60

## 🐛 Troubleshooting

### "Analysis failed" error
- Check API keys are valid
- Verify video is < 60 minutes
- Check Supabase connection

### Slow processing
- Large files take longer
- Check network connection
- Monitor API rate limits

### Export not working
- Verify module ID exists
- Check browser console
- Try re-generating lesson

## 📝 Development

### Adding New Source Types

1. Create service in `src/services/sources/`
2. Add type to `SourceType` enum
3. Update orchestrator routing
4. Add UI option in `SourceInput`

### Modifying Lesson Structure

1. Update database schema
2. Modify types in `src/types/`
3. Update Claude prompt
4. Adjust lesson editor UI

## 🚀 Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
```

### Environment Variables Required
- All variables from `.env.example`
- Set `NODE_ENV=production`

## 📚 Documentation

- [API Routes](docs/API.md)
- [Testing Guide](docs/TESTING.md)
- [Deployment Guide](docs/DEPLOYMENT.md)

## 🎯 Phase 1 Scope

✅ YouTube → Lesson pipeline
✅ PDF/PPTX support
✅ DOCX export
✅ Lesson editor
✅ Supabase integration

## 🔮 Future Phases

- Phase 2: NotebookLM-style collections
- Phase 3: Skills engine
- Phase 4: Full production system

## 📄 License

Proprietary - All Rights Reserved