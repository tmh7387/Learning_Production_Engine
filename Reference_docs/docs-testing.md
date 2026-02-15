# Testing Checklist

## Unit Tests (Optional for Phase 1)

### Services
- [ ] Gemini Video Analysis
- [ ] Gemini Document Analysis
- [ ] Claude Lesson Generation
- [ ] YouTube Download
- [ ] Pipeline Orchestrator

### Components
- [ ] SourceInput validation
- [ ] LessonEditor state management
- [ ] Modal interactions

## Integration Tests

### End-to-End User Flows
1. [ ] YouTube URL → Analysis → Lesson Generation
   - Input valid YouTube URL
   - Wait for analysis completion
   - Verify lesson plan structure
   - Test DOCX export

2. [ ] PDF Upload → Analysis → Lesson Generation
   - Upload PDF file
   - Verify processing
   - Check lesson quality

3. [ ] PPTX Upload → Analysis → Lesson Generation
   - Upload PowerPoint
   - Verify slide analysis
   - Validate generated objectives

### API Routes
- [ ] POST /api/sources/analyze
  - Valid YouTube URL
  - Invalid URL
  - Timeout handling
  
- [ ] POST /api/sources/upload
  - Valid file types
  - File size limits
  - Invalid file types

- [ ] GET /api/export/docx/[moduleId]
  - Valid module ID
  - Non-existent module
  - Download verification

### Database Operations
- [ ] Source creation
- [ ] Analysis storage
- [ ] Lesson plan creation
- [ ] Module/objective/activity linking
- [ ] RLS policy enforcement

## Manual Testing Protocol

### Test Case 1: YouTube Video Analysis
**Steps:**
1. Navigate to homepage
2. Click "Generate from Source"
3. Select "URL" method
4. Enter: https://www.youtube.com/watch?v=dQw4w9WgXcQ
5. Click "Generate Lesson"
6. Wait for completion (~3-5 minutes)
7. Verify lesson plan appears
8. Edit module title
9. Export to DOCX
10. Open downloaded file

**Expected Results:**
- Progress indicators show during processing
- Lesson plan has terminal objective
- 3-5 enabling objectives present
- Activities linked to objectives
- DOCX file opens in Word

### Test Case 2: PDF Upload
**Steps:**
1. Prepare test PDF (5-10 pages)
2. Click "Upload File" option
3. Select PDF
4. Monitor upload progress
5. Wait for analysis
6. Review generated lesson

**Expected Results:**
- File upload succeeds
- Analysis completes without errors
- Lesson reflects PDF content

### Test Case 3: Lesson Editing
**Steps:**
1. Open existing lesson
2. Edit module rationale
3. Modify objective content
4. Change activity description
5. Export to DOCX
6. Verify changes in export

**Expected Results:**
- Changes save automatically
- Toast notifications confirm saves
- Export includes all edits

## Performance Tests

### Metrics to Track
- [ ] YouTube video download time
- [ ] Gemini analysis duration
- [ ] Claude generation time
- [ ] Total end-to-end time
- [ ] DOCX export speed

### Benchmarks
- 10-minute video: < 5 minutes total
- 20-page PDF: < 3 minutes total
- DOCX export: < 5 seconds

## Error Handling Tests

- [ ] Invalid YouTube URL
- [ ] YouTube video too long (>60 min)
- [ ] File too large (>100MB)
- [ ] Network timeout
- [ ] AI API errors
- [ ] Database connection failure