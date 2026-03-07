# Phase 4: Integration Plan for Agent 4

**Agent 4 Role**: Integrate all Phase 4 components into search-audit-worker.ts

---

## 📋 Integration Checklist

### 1. Import All Phase 4 Components

```typescript
// Add to top of search-audit-worker.ts
import { SearchTestLibrary } from '../services/search-test-library';
import { SearchScoring } from '../services/search-scoring';
import { ScreenshotAnnotator } from '../services/screenshot-annotator';
import { ScratchpadManager } from '../services/scratchpad-manager';
import { ReportGenerator } from '../services/report-generator';
```

### 2. Update Job Data Interface

```typescript
export interface SearchAuditJobData {
  auditId: string;
  companyId: string;
  domain: string;
  companyName: string;
  // Add new fields
  enableAnnotation?: boolean;
  enableReportGeneration?: boolean;
  scratchpadDir?: string;
}
```

### 3. Main Execution Flow

```typescript
async function processSearchAudit(job: Job<SearchAuditJobData>) {
  const { auditId, companyId, domain, companyName } = job.data;

  // 1. Initialize components
  const testLibrary = new SearchTestLibrary();
  const annotator = new ScreenshotAnnotator();
  const scratchpad = new ScratchpadManager(
    `./output/${companyName}`,
    companyName,
    auditId
  );

  // 2. Launch browser
  const browser = await launchBrowser();
  const page = await browser.newPage();

  // 3. Execute tests in 4 waves
  const allResults = [];

  // Wave 1: Foundation (5 tests)
  const wave1 = await testLibrary.executeWave(1, page, domain);
  allResults.push(...wave1);
  emitProgress(auditId, 'wave1', 'completed', 20);

  // Wave 2: Core Search (5 tests)
  const wave2 = await testLibrary.executeWave(2, page, domain);
  allResults.push(...wave2);
  emitProgress(auditId, 'wave2', 'completed', 40);

  // Wave 3: Advanced (5 tests)
  const wave3 = await testLibrary.executeWave(3, page, domain);
  allResults.push(...wave3);
  emitProgress(auditId, 'wave3', 'completed', 60);

  // Wave 4: Intelligence (5 tests)
  const wave4 = await testLibrary.executeWave(4, page, domain);
  allResults.push(...wave4);
  emitProgress(auditId, 'wave4', 'completed', 80);

  // 4. Close browser
  await browser.close();

  // 5. Annotate screenshots
  for (const result of allResults) {
    for (const screenshot of result.screenshots) {
      await annotator.annotateScreenshot(
        screenshot.filePath,
        result
      );
    }
  }
  emitProgress(auditId, 'annotation', 'completed', 85);

  // 6. Calculate 10-dimension scores
  const scores = await SearchScoring.calculateScores(allResults);
  emitProgress(auditId, 'scoring', 'completed', 90);

  // 7. Create scratchpad files
  await scratchpad.createFile(9, 'search-tests.md', formatTestResults(allResults));
  await scratchpad.createFile(10, 'screenshots.md', formatScreenshots(allResults));
  await scratchpad.createFile(11, 'scoring.md', formatScores(scores));
  await scratchpad.createFile(12, 'recommendations.md', formatRecommendations(scores));

  // 8. Generate report
  const report = await ReportGenerator.generateReport(
    auditId,
    companyId,
    scratchpad.outputDir
  );
  await ReportGenerator.saveReport(
    report,
    `./output/${companyName}/${companyName}-search-audit.md`
  );
  emitProgress(auditId, 'report', 'completed', 95);

  // 9. Persist to database
  await persistSearchAuditResults(auditId, companyId, allResults, scores);
  emitProgress(auditId, 'persistence', 'completed', 100);

  return {
    auditId,
    companyId,
    status: 'completed',
    overallScore: scores.overall,
    testResults: allResults,
    reportPath: `./output/${companyName}/${companyName}-search-audit.md`
  };
}
```

### 4. Database Persistence

```typescript
async function persistSearchAuditResults(
  auditId: string,
  companyId: string,
  testResults: TestResult[],
  scores: ScoringResult
) {
  const db = new SupabaseClient();

  // Persist test results
  for (const result of testResults) {
    await db.insert('search_audit_tests', {
      company_id: companyId,
      audit_id: auditId,
      test_name: result.testName,
      test_status: result.status,
      test_score: result.score,
      duration_ms: result.duration,
      findings: result.findings,
      evidence: result.evidence,
      executed_at: new Date()
    });

    // Persist screenshots
    for (const screenshot of result.screenshots) {
      await db.insert('search_audit_screenshots', {
        company_id: companyId,
        audit_id: auditId,
        test_name: result.testName,
        sequence_number: screenshot.sequenceNumber,
        caption: screenshot.caption,
        file_path: screenshot.filePath,
        annotations: screenshot.annotations
      });
    }
  }

  // Update audit with scores
  await db.update('audits', auditId, {
    search_overall_score: scores.overall,
    search_relevance_score: scores.relevance,
    search_typo_score: scores.typoTolerance,
    search_synonym_score: scores.synonymDetection,
    search_sayt_score: scores.saytQuality,
    search_facets_score: scores.facets,
    search_empty_state_score: scores.emptyState,
    search_nlp_score: scores.semanticNLP,
    search_dynamic_facets_score: scores.dynamicFacets,
    search_recommendations_score: scores.recommendations,
    search_intelligence_score: scores.searchIntelligence,
    search_status: scores.status, // EXCELLENT/GOOD/FAIR/POOR
    completed_at: new Date()
  });
}
```

### 5. Helper Functions

```typescript
function formatTestResults(results: TestResult[]): string {
  let md = '# Search Test Results\n\n';
  for (const result of results) {
    md += `## ${result.testName}\n`;
    md += `**Status**: ${result.status}\n`;
    md += `**Score**: ${result.score}/10\n`;
    md += `**Duration**: ${result.duration}ms\n\n`;
    if (result.findings.length > 0) {
      md += '### Findings\n';
      result.findings.forEach(f => md += `- ${f}\n`);
      md += '\n';
    }
  }
  return md;
}

function formatScreenshots(results: TestResult[]): string {
  let md = '# Screenshot Inventory\n\n';
  for (const result of results) {
    md += `## ${result.testName}\n\n`;
    for (const screenshot of result.screenshots) {
      md += `### Screenshot ${screenshot.sequenceNumber}\n`;
      md += `**Caption**: ${screenshot.caption}\n`;
      md += `**Path**: ${screenshot.filePath}\n`;
      if (screenshot.annotations && screenshot.annotations.length > 0) {
        md += `**Annotations**: ${screenshot.annotations.length}\n`;
      }
      md += `\n![Screenshot](${screenshot.filePath})\n\n`;
    }
  }
  return md;
}

function formatScores(scores: ScoringResult): string {
  let md = '# Search Quality Scores\n\n';
  md += `## Overall Score: ${scores.overall.toFixed(1)}/10 (${scores.status})\n\n`;
  md += '| Dimension | Score | Weight | Weighted |\n';
  md += '|-----------|-------|--------|----------|\n';
  md += `| Relevance | ${scores.relevance.toFixed(1)}/10 | 15% | ${(scores.relevance * 0.15).toFixed(2)} |\n`;
  md += `| Typo Tolerance | ${scores.typoTolerance.toFixed(1)}/10 | 10% | ${(scores.typoTolerance * 0.10).toFixed(2)} |\n`;
  md += `| Synonym Detection | ${scores.synonymDetection.toFixed(1)}/10 | 10% | ${(scores.synonymDetection * 0.10).toFixed(2)} |\n`;
  md += `| SAYT Quality | ${scores.saytQuality.toFixed(1)}/10 | 10% | ${(scores.saytQuality * 0.10).toFixed(2)} |\n`;
  md += `| Facets | ${scores.facets.toFixed(1)}/10 | 10% | ${(scores.facets * 0.10).toFixed(2)} |\n`;
  md += `| Empty State | ${scores.emptyState.toFixed(1)}/10 | 10% | ${(scores.emptyState * 0.10).toFixed(2)} |\n`;
  md += `| Semantic/NLP | ${scores.semanticNLP.toFixed(1)}/10 | 10% | ${(scores.semanticNLP * 0.10).toFixed(2)} |\n`;
  md += `| Dynamic Facets | ${scores.dynamicFacets.toFixed(1)}/10 | 10% | ${(scores.dynamicFacets * 0.10).toFixed(2)} |\n`;
  md += `| Recommendations | ${scores.recommendations.toFixed(1)}/10 | 10% | ${(scores.recommendations * 0.10).toFixed(2)} |\n`;
  md += `| Intelligence | ${scores.searchIntelligence.toFixed(1)}/10 | 5% | ${(scores.searchIntelligence * 0.05).toFixed(2)} |\n`;
  md += `| **TOTAL** | | **100%** | **${scores.overall.toFixed(2)}** |\n\n`;
  return md;
}

function formatRecommendations(scores: ScoringResult): string {
  let md = '# Algolia Recommendations\n\n';

  // Analyze scores and generate recommendations
  const gaps = [];
  if (scores.relevance < 6) gaps.push({ dim: 'Relevance', score: scores.relevance, solution: 'Algolia\'s AI Search with typo tolerance and ranking formula' });
  if (scores.typoTolerance < 6) gaps.push({ dim: 'Typo Tolerance', score: scores.typoTolerance, solution: 'Built-in typo tolerance (up to 3 character changes)' });
  if (scores.synonymDetection < 6) gaps.push({ dim: 'Synonyms', score: scores.synonymDetection, solution: 'Dynamic Synonym Suggestions and custom synonym dictionaries' });
  if (scores.saytQuality < 6) gaps.push({ dim: 'SAYT', score: scores.saytQuality, solution: 'InstantSearch with Query Suggestions' });
  if (scores.facets < 6) gaps.push({ dim: 'Facets', score: scores.facets, solution: 'Dynamic Faceting with accurate counts' });
  if (scores.emptyState < 6) gaps.push({ dim: 'Empty State', score: scores.emptyState, solution: 'Query Suggestions API for alternatives' });
  if (scores.semanticNLP < 6) gaps.push({ dim: 'NLP', score: scores.semanticNLP, solution: 'AI Search with natural language understanding' });
  if (scores.dynamicFacets < 6) gaps.push({ dim: 'Personalization', score: scores.dynamicFacets, solution: 'Personalization and Dynamic Re-Ranking' });
  if (scores.recommendations < 6) gaps.push({ dim: 'Recommendations', score: scores.recommendations, solution: 'Recommend for related products and merchandising' });
  if (scores.searchIntelligence < 6) gaps.push({ dim: 'Analytics', score: scores.searchIntelligence, solution: 'Search Analytics and A/B Testing' });

  gaps.sort((a, b) => a.score - b.score);

  md += '## Critical Gaps (Immediate Opportunities)\n\n';
  gaps.slice(0, 3).forEach((gap, i) => {
    md += `### ${i + 1}. ${gap.dim} (${gap.score.toFixed(1)}/10)\n`;
    md += `**Algolia Solution**: ${gap.solution}\n\n`;
  });

  if (gaps.length > 3) {
    md += '## Additional Opportunities\n\n';
    gaps.slice(3).forEach((gap, i) => {
      md += `### ${i + 4}. ${gap.dim} (${gap.score.toFixed(1)}/10)\n`;
      md += `**Algolia Solution**: ${gap.solution}\n\n`;
    });
  }

  return md;
}
```

---

## 📝 Files to Modify

1. **backend/workers/search-audit-worker.ts**
   - Add imports
   - Update processSearchAudit() function
   - Add helper functions
   - Add database persistence

---

## 🧪 Integration Test

Create `backend/tests/search-audit-integration.test.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';
import { SearchAuditWorker } from '../workers/search-audit-worker';

describe('Search Audit Integration', () => {
  it('should complete full search audit workflow', async () => {
    const worker = new SearchAuditWorker();

    const result = await worker.processSearchAudit({
      auditId: 'test-audit-001',
      companyId: 'test-company-001',
      domain: 'example.com',
      companyName: 'Example Corp'
    });

    expect(result.status).toBe('completed');
    expect(result.testResults).toHaveLength(20);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(10);
    expect(result.reportPath).toContain('example-corp-search-audit.md');
  });
});
```

---

## ✅ Validation Checklist

- [ ] All imports working
- [ ] Tests execute in waves
- [ ] Screenshots captured and annotated
- [ ] Scores calculated correctly
- [ ] Scratchpad files created
- [ ] Report generated
- [ ] Database persistence working
- [ ] WebSocket progress updates working
- [ ] TypeScript compiles
- [ ] Integration test passing

---

**Ready for Agent 4 execution once Agents 1-3 complete.**
