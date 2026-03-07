/**
 * Screenshot Annotator Tests
 *
 * Tests for the screenshot annotation engine.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import {
  ScreenshotAnnotator,
  Annotation,
  DetectedIssue,
  getSeverityColor,
  validateScreenshotPath,
  getScreenshotDimensions,
} from '../services/screenshot-annotator';

// Test data directory
const TEST_DIR = path.join(__dirname, 'fixtures', 'screenshots');
const OUTPUT_DIR = path.join(__dirname, 'output', 'annotated');

/**
 * Create a test screenshot
 */
async function createTestScreenshot(
  width: number,
  height: number,
  filename: string
): Promise<string> {
  const screenshotPath = path.join(TEST_DIR, filename);
  await fs.mkdir(TEST_DIR, { recursive: true });

  // Create a white image with some color blocks (simulating a webpage)
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      // Header area (blue)
      {
        input: Buffer.from(
          `<svg width="${width}" height="100"><rect width="${width}" height="100" fill="#003DFF"/></svg>`
        ),
        top: 0,
        left: 0,
      },
      // Search box area (white)
      {
        input: Buffer.from(
          `<svg width="${width * 0.5}" height="50"><rect width="${width * 0.5}" height="50" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="2"/></svg>`
        ),
        top: 80,
        left: Math.floor(width * 0.25),
      },
      // Content area (light gray)
      {
        input: Buffer.from(
          `<svg width="${width}" height="${height - 150}"><rect width="${width}" height="${height - 150}" fill="#F5F5F5"/></svg>`
        ),
        top: 150,
        left: 0,
      },
    ])
    .png()
    .toFile(screenshotPath);

  return screenshotPath;
}

describe('ScreenshotAnnotator', () => {
  beforeAll(async () => {
    // Create test directories
    await fs.mkdir(TEST_DIR, { recursive: true });
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test files (optional - comment out to inspect output)
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
      await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  });

  describe('Constructor', () => {
    it('should create annotator with default options', () => {
      const annotator = new ScreenshotAnnotator();
      expect(annotator).toBeDefined();
    });

    it('should create annotator with custom options', () => {
      const annotator = new ScreenshotAnnotator({
        detectEmptyState: false,
        detectTypos: true,
        fontSize: 20,
      });
      expect(annotator).toBeDefined();
    });
  });

  describe('detectIssues', () => {
    it('should detect issues in screenshot', async () => {
      const screenshotPath = await createTestScreenshot(1200, 800, 'test-detect.png');
      const annotator = new ScreenshotAnnotator();

      const issues = await annotator.detectIssues(screenshotPath);

      expect(Array.isArray(issues)).toBe(true);
      // Note: Actual detection would require real screenshots with issues
      // For now, we verify the structure
    });

    it('should handle non-existent file gracefully', async () => {
      const annotator = new ScreenshotAnnotator();
      const issues = await annotator.detectIssues('/non/existent/file.png');

      expect(Array.isArray(issues)).toBe(true);
      expect(issues.length).toBe(0);
    });
  });

  describe('annotateScreenshot', () => {
    it('should annotate screenshot with box', async () => {
      const screenshotPath = await createTestScreenshot(1200, 800, 'test-box.png');
      const annotator = new ScreenshotAnnotator();

      const annotation: Annotation = {
        type: 'box',
        x: 100,
        y: 200,
        width: 300,
        height: 200,
        color: '#DC2626',
        label: 'Critical Issue',
        severity: 'critical',
      };

      const annotatedPath = await annotator.annotateScreenshot(screenshotPath, [annotation]);

      expect(annotatedPath).toContain('-annotated.png');

      // Verify file exists
      const stats = await fs.stat(annotatedPath);
      expect(stats.isFile()).toBe(true);
    });

    it('should annotate screenshot with arrow', async () => {
      const screenshotPath = await createTestScreenshot(1200, 800, 'test-arrow.png');
      const annotator = new ScreenshotAnnotator();

      const annotation: Annotation = {
        type: 'arrow',
        x: 100,
        y: 100,
        width: 150,
        height: 150,
        color: '#F59E0B',
        label: 'Warning',
        severity: 'warning',
      };

      const annotatedPath = await annotator.annotateScreenshot(screenshotPath, [annotation]);

      expect(annotatedPath).toContain('-annotated.png');

      const stats = await fs.stat(annotatedPath);
      expect(stats.isFile()).toBe(true);
    });

    it('should annotate screenshot with underline', async () => {
      const screenshotPath = await createTestScreenshot(1200, 800, 'test-underline.png');
      const annotator = new ScreenshotAnnotator();

      const annotation: Annotation = {
        type: 'underline',
        x: 300,
        y: 150,
        width: 400,
        height: 3,
        color: '#DC2626',
        severity: 'critical',
      };

      const annotatedPath = await annotator.annotateScreenshot(screenshotPath, [annotation]);

      expect(annotatedPath).toContain('-annotated.png');

      const stats = await fs.stat(annotatedPath);
      expect(stats.isFile()).toBe(true);
    });

    it('should annotate screenshot with text label', async () => {
      const screenshotPath = await createTestScreenshot(1200, 800, 'test-text.png');
      const annotator = new ScreenshotAnnotator();

      const annotation: Annotation = {
        type: 'text',
        x: 100,
        y: 300,
        color: '#10B981',
        label: 'Success',
        severity: 'success',
      };

      const annotatedPath = await annotator.annotateScreenshot(screenshotPath, [annotation]);

      expect(annotatedPath).toContain('-annotated.png');

      const stats = await fs.stat(annotatedPath);
      expect(stats.isFile()).toBe(true);
    });

    it('should handle multiple annotations', async () => {
      const screenshotPath = await createTestScreenshot(1200, 800, 'test-multiple.png');
      const annotator = new ScreenshotAnnotator();

      const annotations: Annotation[] = [
        {
          type: 'box',
          x: 100,
          y: 200,
          width: 200,
          height: 150,
          color: '#DC2626',
          label: 'Issue 1',
          severity: 'critical',
        },
        {
          type: 'box',
          x: 400,
          y: 200,
          width: 200,
          height: 150,
          color: '#F59E0B',
          label: 'Issue 2',
          severity: 'warning',
        },
        {
          type: 'arrow',
          x: 700,
          y: 100,
          width: 100,
          height: 100,
          color: '#3B82F6',
          label: 'Info',
          severity: 'info',
        },
      ];

      const annotatedPath = await annotator.annotateScreenshot(screenshotPath, annotations);

      expect(annotatedPath).toContain('-annotated.png');

      const stats = await fs.stat(annotatedPath);
      expect(stats.isFile()).toBe(true);
    });

    it('should return original path if no annotations', async () => {
      const screenshotPath = await createTestScreenshot(1200, 800, 'test-no-annotations.png');
      const annotator = new ScreenshotAnnotator({
        detectEmptyState: false,
        detectTypos: false,
        detectPoorRelevance: false,
        detectSlowLoad: false,
        detectMissingSAYT: false,
        detectBrokenFacets: false,
      });

      const annotatedPath = await annotator.annotateScreenshot(screenshotPath);

      // Should return original path since no issues detected
      expect(annotatedPath).toBe(screenshotPath);
    });
  });

  describe('batchAnnotate', () => {
    it('should annotate multiple screenshots', async () => {
      const paths = await Promise.all([
        createTestScreenshot(1200, 800, 'batch-1.png'),
        createTestScreenshot(1200, 800, 'batch-2.png'),
        createTestScreenshot(1200, 800, 'batch-3.png'),
      ]);

      const annotator = new ScreenshotAnnotator();
      const annotatedPaths = await annotator.batchAnnotate(paths);

      expect(annotatedPaths.length).toBe(3);

      // Verify all files exist (or are original paths if no issues detected)
      for (const path of annotatedPaths) {
        const stats = await fs.stat(path);
        expect(stats.isFile()).toBe(true);
      }
    });
  });

  describe('addAnnotation', () => {
    it('should add single annotation', async () => {
      const screenshotPath = await createTestScreenshot(1200, 800, 'test-add.png');
      const annotator = new ScreenshotAnnotator();

      const annotation: Annotation = {
        type: 'box',
        x: 200,
        y: 300,
        width: 250,
        height: 180,
        color: '#5468FF',
        label: 'Custom',
        severity: 'info',
      };

      const annotatedPath = await annotator.addAnnotation(screenshotPath, annotation);

      expect(annotatedPath).toContain('-annotated.png');

      const stats = await fs.stat(annotatedPath);
      expect(stats.isFile()).toBe(true);
    });
  });

  describe('createComparison', () => {
    it('should create side-by-side comparison', async () => {
      const beforePath = await createTestScreenshot(800, 600, 'before.png');
      const afterPath = await createTestScreenshot(800, 600, 'after.png');
      const outputPath = path.join(OUTPUT_DIR, 'comparison.png');

      const annotator = new ScreenshotAnnotator();
      const comparisonPath = await annotator.createComparison(
        beforePath,
        afterPath,
        outputPath
      );

      expect(comparisonPath).toBe(outputPath);

      const stats = await fs.stat(comparisonPath);
      expect(stats.isFile()).toBe(true);

      // Verify dimensions (should be roughly double width + padding)
      const metadata = await sharp(comparisonPath).metadata();
      expect(metadata.width).toBeGreaterThan(800 * 2);
    });
  });
});

describe('Helper Functions', () => {
  describe('getSeverityColor', () => {
    it('should return correct colors for severities', () => {
      expect(getSeverityColor('critical')).toBe('#DC2626');
      expect(getSeverityColor('warning')).toBe('#F59E0B');
      expect(getSeverityColor('success')).toBe('#10B981');
      expect(getSeverityColor('info')).toBe('#3B82F6');
    });
  });

  describe('validateScreenshotPath', () => {
    it('should validate existing PNG file', async () => {
      const screenshotPath = await createTestScreenshot(100, 100, 'validate.png');
      const isValid = await validateScreenshotPath(screenshotPath);
      expect(isValid).toBe(true);
    });

    it('should reject non-existent file', async () => {
      const isValid = await validateScreenshotPath('/non/existent/file.png');
      expect(isValid).toBe(false);
    });

    it('should reject non-PNG file', async () => {
      const txtPath = path.join(TEST_DIR, 'test.txt');
      await fs.writeFile(txtPath, 'test');

      const isValid = await validateScreenshotPath(txtPath);
      expect(isValid).toBe(false);
    });
  });

  describe('getScreenshotDimensions', () => {
    it('should return correct dimensions', async () => {
      const screenshotPath = await createTestScreenshot(1920, 1080, 'dimensions.png');
      const dimensions = await getScreenshotDimensions(screenshotPath);

      expect(dimensions).not.toBeNull();
      expect(dimensions?.width).toBe(1920);
      expect(dimensions?.height).toBe(1080);
    });

    it('should return null for invalid file', async () => {
      const dimensions = await getScreenshotDimensions('/non/existent/file.png');
      expect(dimensions).toBeNull();
    });
  });
});

describe('Integration Tests', () => {
  it('should complete full annotation workflow', async () => {
    const annotator = new ScreenshotAnnotator();

    // 1. Create test screenshot
    const screenshotPath = await createTestScreenshot(1200, 800, 'workflow.png');

    // 2. Detect issues
    const issues = await annotator.detectIssues(screenshotPath);
    expect(Array.isArray(issues)).toBe(true);

    // 3. Annotate with detected issues
    const annotatedPath = await annotator.annotateScreenshot(screenshotPath);
    expect(annotatedPath).toBeDefined();

    // 4. Verify output
    const stats = await fs.stat(annotatedPath);
    expect(stats.isFile()).toBe(true);

    // 5. Verify dimensions preserved
    const originalDims = await getScreenshotDimensions(screenshotPath);
    const annotatedDims = await getScreenshotDimensions(annotatedPath);

    expect(annotatedDims?.width).toBe(originalDims?.width);
    expect(annotatedDims?.height).toBe(originalDims?.height);
  });

  it('should handle real-world annotation scenario', async () => {
    const annotator = new ScreenshotAnnotator();

    // Create screenshot
    const screenshotPath = await createTestScreenshot(1920, 1080, 'realworld.png');

    // Add multiple annotations (simulating real audit findings)
    const annotations: Annotation[] = [
      // Critical issue: Empty results
      {
        type: 'box',
        x: 400,
        y: 300,
        width: 800,
        height: 400,
        color: '#DC2626',
        label: 'Empty Results - Critical',
        severity: 'critical',
      },
      // Warning: Poor relevance
      {
        type: 'box',
        x: 100,
        y: 250,
        width: 250,
        height: 200,
        color: '#F59E0B',
        label: 'Poor Relevance',
        severity: 'warning',
      },
      // Info: Slow load
      {
        type: 'arrow',
        x: 900,
        y: 150,
        width: 100,
        height: 100,
        color: '#3B82F6',
        label: 'Loading Spinner',
        severity: 'info',
      },
    ];

    const annotatedPath = await annotator.annotateScreenshot(screenshotPath, annotations);

    // Verify
    expect(annotatedPath).toContain('-annotated.png');

    const stats = await fs.stat(annotatedPath);
    expect(stats.size).toBeGreaterThan(0);
  });
});
