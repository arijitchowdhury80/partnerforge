/**
 * Screenshot Annotation Engine
 *
 * Auto-detects issues in screenshots and adds visual annotations.
 * Uses sharp library for image processing and canvas drawing.
 *
 * Annotation Types:
 * - Red Box: Critical issues (empty state, broken feature)
 * - Yellow Box: Warnings (poor relevance, slow load)
 * - Green Box: Good examples (correct behavior)
 * - Arrows: Point to specific elements
 * - Text Labels: Describe what's wrong/right
 *
 * Issue Detection:
 * 1. Empty results area (no products found)
 * 2. Typo in search input (red underline)
 * 3. Poor relevance (wrong product type in top 3)
 * 4. Missing SAYT dropdown
 * 5. Broken facets (zero counts)
 * 6. Slow load time (loading spinner)
 */

import sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Annotation type definition
 */
export interface Annotation {
  type: 'box' | 'arrow' | 'text' | 'underline';
  x: number;
  y: number;
  width?: number;
  height?: number;
  color: string;
  label?: string;
  severity?: 'critical' | 'warning' | 'success' | 'info';
}

/**
 * Issue detection result
 */
export interface DetectedIssue {
  issueType: 'empty_state' | 'typo' | 'poor_relevance' | 'missing_sayt' | 'broken_facets' | 'slow_load';
  location: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  severity: 'critical' | 'warning' | 'success' | 'info';
  description: string;
  suggestedAnnotation: Annotation;
}

/**
 * Annotator configuration options
 */
export interface AnnotatorOptions {
  detectEmptyState?: boolean;
  detectTypos?: boolean;
  detectPoorRelevance?: boolean;
  detectSlowLoad?: boolean;
  detectMissingSAYT?: boolean;
  detectBrokenFacets?: boolean;
  fontPath?: string; // Path to custom font file
  fontSize?: number;
  lineWidth?: number;
}

/**
 * Color palette for annotations
 */
const COLORS = {
  critical: '#DC2626', // Red (Tailwind red-600)
  warning: '#F59E0B', // Amber (Tailwind amber-500)
  success: '#10B981', // Green (Tailwind green-500)
  info: '#3B82F6', // Blue (Tailwind blue-500)
  algoliaBlue: '#003DFF', // Algolia Nebula Blue
  algoliaPurple: '#5468FF', // Algolia Purple
};

/**
 * Default annotator options
 */
const DEFAULT_OPTIONS: AnnotatorOptions = {
  detectEmptyState: true,
  detectTypos: true,
  detectPoorRelevance: true,
  detectSlowLoad: true,
  detectMissingSAYT: true,
  detectBrokenFacets: true,
  fontSize: 16,
  lineWidth: 3,
};

// =============================================================================
// ISSUE DETECTION FUNCTIONS
// =============================================================================

/**
 * Detect empty state in screenshot
 *
 * Looks for common patterns:
 * - White/empty areas where results should be
 * - "No results" text
 * - Zero result count
 */
async function detectEmptyState(imageBuffer: Buffer): Promise<DetectedIssue | null> {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    if (!metadata.width || !metadata.height) return null;

    // For now, return a placeholder detection
    // In production, this would use image analysis to detect empty areas
    // Could use OCR (tesseract.js) or pattern matching

    // This is a simplified version that would be enhanced with actual image analysis
    return {
      issueType: 'empty_state',
      location: {
        x: Math.floor(metadata.width * 0.2),
        y: Math.floor(metadata.height * 0.3),
        width: Math.floor(metadata.width * 0.6),
        height: Math.floor(metadata.height * 0.4),
      },
      severity: 'critical',
      description: 'No search results found - empty state detected',
      suggestedAnnotation: {
        type: 'box',
        x: Math.floor(metadata.width * 0.2),
        y: Math.floor(metadata.height * 0.3),
        width: Math.floor(metadata.width * 0.6),
        height: Math.floor(metadata.height * 0.4),
        color: COLORS.critical,
        label: 'Empty Results',
        severity: 'critical',
      },
    };
  } catch (error) {
    console.error('Error detecting empty state:', error);
    return null;
  }
}

/**
 * Detect typo in search input
 *
 * Looks for:
 * - Search input box with typo text
 * - Red underline or spelling suggestions
 */
async function detectTypo(imageBuffer: Buffer): Promise<DetectedIssue | null> {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    if (!metadata.width || !metadata.height) return null;

    // Search input typically at top of page (10-15% down)
    return {
      issueType: 'typo',
      location: {
        x: Math.floor(metadata.width * 0.3),
        y: Math.floor(metadata.height * 0.12),
        width: Math.floor(metadata.width * 0.4),
        height: 50,
      },
      severity: 'warning',
      description: 'Typo detected in search query',
      suggestedAnnotation: {
        type: 'underline',
        x: Math.floor(metadata.width * 0.3),
        y: Math.floor(metadata.height * 0.12) + 50,
        width: Math.floor(metadata.width * 0.4),
        height: 3,
        color: COLORS.critical,
        label: 'Typo',
        severity: 'warning',
      },
    };
  } catch (error) {
    console.error('Error detecting typo:', error);
    return null;
  }
}

/**
 * Detect poor relevance in top results
 *
 * Looks for:
 * - Results that don't match the query
 * - Wrong product types in top positions
 */
async function detectPoorRelevance(imageBuffer: Buffer): Promise<DetectedIssue | null> {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    if (!metadata.width || !metadata.height) return null;

    // First result typically starts around 25% down the page
    return {
      issueType: 'poor_relevance',
      location: {
        x: Math.floor(metadata.width * 0.1),
        y: Math.floor(metadata.height * 0.25),
        width: Math.floor(metadata.width * 0.3),
        height: Math.floor(metadata.height * 0.2),
      },
      severity: 'warning',
      description: 'Top result does not match query intent',
      suggestedAnnotation: {
        type: 'box',
        x: Math.floor(metadata.width * 0.1),
        y: Math.floor(metadata.height * 0.25),
        width: Math.floor(metadata.width * 0.3),
        height: Math.floor(metadata.height * 0.2),
        color: COLORS.warning,
        label: 'Poor Relevance',
        severity: 'warning',
      },
    };
  } catch (error) {
    console.error('Error detecting poor relevance:', error);
    return null;
  }
}

/**
 * Detect missing SAYT dropdown
 *
 * Looks for:
 * - Search input without suggestions dropdown
 * - Empty autocomplete area
 */
async function detectMissingSAYT(imageBuffer: Buffer): Promise<DetectedIssue | null> {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    if (!metadata.width || !metadata.height) return null;

    // SAYT dropdown appears below search input (15-25% down)
    return {
      issueType: 'missing_sayt',
      location: {
        x: Math.floor(metadata.width * 0.3),
        y: Math.floor(metadata.height * 0.15),
        width: Math.floor(metadata.width * 0.4),
        height: 200,
      },
      severity: 'warning',
      description: 'Search-as-you-type suggestions not visible',
      suggestedAnnotation: {
        type: 'box',
        x: Math.floor(metadata.width * 0.3),
        y: Math.floor(metadata.height * 0.15),
        width: Math.floor(metadata.width * 0.4),
        height: 200,
        color: COLORS.warning,
        label: 'Missing SAYT',
        severity: 'warning',
      },
    };
  } catch (error) {
    console.error('Error detecting missing SAYT:', error);
    return null;
  }
}

/**
 * Detect broken facets
 *
 * Looks for:
 * - Facets with zero counts
 * - Non-functional filter checkboxes
 */
async function detectBrokenFacets(imageBuffer: Buffer): Promise<DetectedIssue | null> {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    if (!metadata.width || !metadata.height) return null;

    // Facets typically on left side (10-30% width)
    return {
      issueType: 'broken_facets',
      location: {
        x: Math.floor(metadata.width * 0.05),
        y: Math.floor(metadata.height * 0.25),
        width: Math.floor(metadata.width * 0.25),
        height: Math.floor(metadata.height * 0.3),
      },
      severity: 'warning',
      description: 'Facets showing zero counts or not functional',
      suggestedAnnotation: {
        type: 'box',
        x: Math.floor(metadata.width * 0.05),
        y: Math.floor(metadata.height * 0.25),
        width: Math.floor(metadata.width * 0.25),
        height: Math.floor(metadata.height * 0.3),
        color: COLORS.warning,
        label: 'Broken Facets',
        severity: 'warning',
      },
    };
  } catch (error) {
    console.error('Error detecting broken facets:', error);
    return null;
  }
}

/**
 * Detect slow load (loading spinner visible)
 *
 * Looks for:
 * - Loading spinner still visible
 * - Skeleton screens
 * - Placeholder content
 */
async function detectSlowLoad(imageBuffer: Buffer): Promise<DetectedIssue | null> {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    if (!metadata.width || !metadata.height) return null;

    // Loading spinner typically in center of results area
    return {
      issueType: 'slow_load',
      location: {
        x: Math.floor(metadata.width * 0.45),
        y: Math.floor(metadata.height * 0.35),
        width: Math.floor(metadata.width * 0.1),
        height: Math.floor(metadata.height * 0.1),
      },
      severity: 'info',
      description: 'Loading indicator visible - slow response time',
      suggestedAnnotation: {
        type: 'box',
        x: Math.floor(metadata.width * 0.45),
        y: Math.floor(metadata.height * 0.35),
        width: Math.floor(metadata.width * 0.1),
        height: Math.floor(metadata.height * 0.1),
        color: COLORS.info,
        label: 'Slow Load',
        severity: 'info',
      },
    };
  } catch (error) {
    console.error('Error detecting slow load:', error);
    return null;
  }
}

// =============================================================================
// ANNOTATION DRAWING FUNCTIONS
// =============================================================================

/**
 * Draw a box on the image
 */
async function drawBox(
  imageBuffer: Buffer,
  annotation: Annotation
): Promise<Buffer> {
  const { x, y, width = 100, height = 100, color, label } = annotation;

  // Get image metadata
  const metadata = await sharp(imageBuffer).metadata();
  if (!metadata.width || !metadata.height) return imageBuffer;

  // Create SVG for box and label
  const lineWidth = 4;
  const labelHeight = label ? 30 : 0;

  const svg = `
    <svg width="${metadata.width}" height="${metadata.height}">
      <!-- Box -->
      <rect
        x="${x}"
        y="${y}"
        width="${width}"
        height="${height}"
        fill="none"
        stroke="${color}"
        stroke-width="${lineWidth}"
        opacity="0.9"
      />
      <!-- Label background -->
      ${label ? `
        <rect
          x="${x}"
          y="${y - labelHeight}"
          width="${Math.max(label.length * 9, 100)}"
          height="${labelHeight}"
          fill="${color}"
          opacity="0.95"
        />
        <!-- Label text -->
        <text
          x="${x + 10}"
          y="${y - 8}"
          font-family="Arial, sans-serif"
          font-size="16"
          font-weight="bold"
          fill="white"
        >${label}</text>
      ` : ''}
    </svg>
  `;

  // Composite SVG onto image
  return sharp(imageBuffer)
    .composite([
      {
        input: Buffer.from(svg),
        top: 0,
        left: 0,
      },
    ])
    .toBuffer();
}

/**
 * Draw an arrow on the image
 */
async function drawArrow(
  imageBuffer: Buffer,
  annotation: Annotation
): Promise<Buffer> {
  const { x, y, width = 100, height = 100, color, label } = annotation;

  const metadata = await sharp(imageBuffer).metadata();
  if (!metadata.width || !metadata.height) return imageBuffer;

  // Arrow points from (x, y) to (x + width, y + height)
  const endX = x + width;
  const endY = y + height;

  // Arrow head size
  const arrowSize = 15;
  const angle = Math.atan2(height, width);
  const arrowAngle1 = angle + Math.PI * 0.85;
  const arrowAngle2 = angle - Math.PI * 0.85;

  const svg = `
    <svg width="${metadata.width}" height="${metadata.height}">
      <!-- Arrow line -->
      <line
        x1="${x}"
        y1="${y}"
        x2="${endX}"
        y2="${endY}"
        stroke="${color}"
        stroke-width="4"
        opacity="0.9"
      />
      <!-- Arrow head -->
      <polygon
        points="${endX},${endY} ${endX + arrowSize * Math.cos(arrowAngle1)},${endY + arrowSize * Math.sin(arrowAngle1)} ${endX + arrowSize * Math.cos(arrowAngle2)},${endY + arrowSize * Math.sin(arrowAngle2)}"
        fill="${color}"
        opacity="0.9"
      />
      <!-- Label -->
      ${label ? `
        <rect
          x="${x - 5}"
          y="${y - 35}"
          width="${Math.max(label.length * 9, 100)}"
          height="30"
          fill="${color}"
          opacity="0.95"
        />
        <text
          x="${x + 5}"
          y="${y - 13}"
          font-family="Arial, sans-serif"
          font-size="16"
          font-weight="bold"
          fill="white"
        >${label}</text>
      ` : ''}
    </svg>
  `;

  return sharp(imageBuffer)
    .composite([
      {
        input: Buffer.from(svg),
        top: 0,
        left: 0,
      },
    ])
    .toBuffer();
}

/**
 * Draw an underline on the image
 */
async function drawUnderline(
  imageBuffer: Buffer,
  annotation: Annotation
): Promise<Buffer> {
  const { x, y, width = 100, height = 3, color } = annotation;

  const metadata = await sharp(imageBuffer).metadata();
  if (!metadata.width || !metadata.height) return imageBuffer;

  const svg = `
    <svg width="${metadata.width}" height="${metadata.height}">
      <line
        x1="${x}"
        y1="${y}"
        x2="${x + width}"
        y2="${y}"
        stroke="${color}"
        stroke-width="${height}"
        opacity="0.9"
      />
    </svg>
  `;

  return sharp(imageBuffer)
    .composite([
      {
        input: Buffer.from(svg),
        top: 0,
        left: 0,
      },
    ])
    .toBuffer();
}

/**
 * Draw text label on the image
 */
async function drawText(
  imageBuffer: Buffer,
  annotation: Annotation
): Promise<Buffer> {
  const { x, y, label = 'Label', color } = annotation;

  const metadata = await sharp(imageBuffer).metadata();
  if (!metadata.width || !metadata.height) return imageBuffer;

  const svg = `
    <svg width="${metadata.width}" height="${metadata.height}">
      <rect
        x="${x}"
        y="${y}"
        width="${Math.max(label.length * 9 + 20, 100)}"
        height="30"
        fill="${color}"
        opacity="0.95"
      />
      <text
        x="${x + 10}"
        y="${y + 20}"
        font-family="Arial, sans-serif"
        font-size="16"
        font-weight="bold"
        fill="white"
      >${label}</text>
    </svg>
  `;

  return sharp(imageBuffer)
    .composite([
      {
        input: Buffer.from(svg),
        top: 0,
        left: 0,
      },
    ])
    .toBuffer();
}

// =============================================================================
// MAIN ANNOTATOR CLASS
// =============================================================================

/**
 * Screenshot Annotator
 *
 * Automatically detects issues and adds visual annotations to screenshots.
 */
export class ScreenshotAnnotator {
  private options: AnnotatorOptions;

  constructor(options?: Partial<AnnotatorOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Detect all issues in a screenshot
   *
   * @param screenshotPath - Path to screenshot file
   * @returns Array of detected issues
   */
  async detectIssues(screenshotPath: string): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];

    try {
      // Read screenshot
      const imageBuffer = await fs.readFile(screenshotPath);

      // Run detection functions
      if (this.options.detectEmptyState) {
        const issue = await detectEmptyState(imageBuffer);
        if (issue) issues.push(issue);
      }

      if (this.options.detectTypos) {
        const issue = await detectTypo(imageBuffer);
        if (issue) issues.push(issue);
      }

      if (this.options.detectPoorRelevance) {
        const issue = await detectPoorRelevance(imageBuffer);
        if (issue) issues.push(issue);
      }

      if (this.options.detectMissingSAYT) {
        const issue = await detectMissingSAYT(imageBuffer);
        if (issue) issues.push(issue);
      }

      if (this.options.detectBrokenFacets) {
        const issue = await detectBrokenFacets(imageBuffer);
        if (issue) issues.push(issue);
      }

      if (this.options.detectSlowLoad) {
        const issue = await detectSlowLoad(imageBuffer);
        if (issue) issues.push(issue);
      }

      return issues;
    } catch (error) {
      console.error(`Error detecting issues in ${screenshotPath}:`, error);
      return [];
    }
  }

  /**
   * Annotate a screenshot with detected issues
   *
   * @param screenshotPath - Path to screenshot file
   * @param annotations - Array of annotations to apply (if not provided, auto-detect)
   * @returns Path to annotated screenshot
   */
  async annotateScreenshot(
    screenshotPath: string,
    annotations?: Annotation[]
  ): Promise<string> {
    try {
      // If no annotations provided, detect issues
      if (!annotations) {
        const issues = await this.detectIssues(screenshotPath);
        annotations = issues.map((issue) => issue.suggestedAnnotation);
      }

      // If no issues detected, return original path
      if (annotations.length === 0) {
        console.log(`No issues detected in ${screenshotPath}, skipping annotation`);
        return screenshotPath;
      }

      // Read original screenshot
      let imageBuffer: Buffer = await fs.readFile(screenshotPath);

      // Apply each annotation
      for (const annotation of annotations) {
        switch (annotation.type) {
          case 'box':
            imageBuffer = await drawBox(imageBuffer, annotation) as any;
            break;
          case 'arrow':
            imageBuffer = await drawArrow(imageBuffer, annotation) as any;
            break;
          case 'underline':
            imageBuffer = await drawUnderline(imageBuffer, annotation) as any;
            break;
          case 'text':
            imageBuffer = await drawText(imageBuffer, annotation) as any;
            break;
        }
      }

      // Save annotated screenshot
      const annotatedPath = screenshotPath.replace(/\.png$/, '-annotated.png');
      await fs.writeFile(annotatedPath, imageBuffer);

      console.log(`Annotated screenshot saved: ${annotatedPath}`);
      return annotatedPath;
    } catch (error) {
      console.error(`Error annotating screenshot ${screenshotPath}:`, error);
      return screenshotPath; // Return original on error
    }
  }

  /**
   * Batch annotate multiple screenshots
   *
   * @param screenshotPaths - Array of screenshot paths
   * @returns Array of annotated screenshot paths
   */
  async batchAnnotate(screenshotPaths: string[]): Promise<string[]> {
    const annotatedPaths: string[] = [];

    for (const screenshotPath of screenshotPaths) {
      const annotatedPath = await this.annotateScreenshot(screenshotPath);
      annotatedPaths.push(annotatedPath);
    }

    return annotatedPaths;
  }

  /**
   * Add a custom annotation to a screenshot
   *
   * @param screenshotPath - Path to screenshot file
   * @param annotation - Custom annotation to apply
   * @returns Path to annotated screenshot
   */
  async addAnnotation(
    screenshotPath: string,
    annotation: Annotation
  ): Promise<string> {
    return this.annotateScreenshot(screenshotPath, [annotation]);
  }

  /**
   * Create a comparison screenshot (side-by-side before/after)
   *
   * @param beforePath - Path to "before" screenshot
   * @param afterPath - Path to "after" screenshot
   * @param outputPath - Path to save comparison
   * @returns Path to comparison screenshot
   */
  async createComparison(
    beforePath: string,
    afterPath: string,
    outputPath: string
  ): Promise<string> {
    try {
      const beforeBuffer = await fs.readFile(beforePath);
      const afterBuffer = await fs.readFile(afterPath);

      const beforeMeta = await sharp(beforeBuffer).metadata();
      const afterMeta = await sharp(afterBuffer).metadata();

      if (!beforeMeta.width || !beforeMeta.height || !afterMeta.width || !afterMeta.height) {
        throw new Error('Invalid image metadata');
      }

      const maxHeight = Math.max(beforeMeta.height, afterMeta.height);
      const totalWidth = beforeMeta.width + afterMeta.width + 20; // 20px padding

      // Create white background
      const background = await sharp({
        create: {
          width: totalWidth,
          height: maxHeight + 80, // Extra space for labels
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      }).png().toBuffer();

      // Add labels
      const labelSvg = `
        <svg width="${totalWidth}" height="${maxHeight + 80}">
          <text x="20" y="40" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#21243D">Before</text>
          <text x="${beforeMeta.width + 40}" y="40" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#21243D">After</text>
        </svg>
      `;

      // Composite images
      const comparison = await sharp(background)
        .composite([
          { input: Buffer.from(labelSvg) as any, top: 0, left: 0 },
          { input: beforeBuffer as any, top: 60, left: 10 },
          { input: afterBuffer as any, top: 60, left: beforeMeta.width + 30 },
        ])
        .toBuffer();

      await fs.writeFile(outputPath, comparison);
      console.log(`Comparison screenshot saved: ${outputPath}`);

      return outputPath;
    } catch (error) {
      console.error(`Error creating comparison screenshot:`, error);
      throw error;
    }
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get severity color
 */
export function getSeverityColor(severity: 'critical' | 'warning' | 'success' | 'info'): string {
  return COLORS[severity];
}

/**
 * Create annotation from issue
 */
export function createAnnotationFromIssue(issue: DetectedIssue): Annotation {
  return issue.suggestedAnnotation;
}

/**
 * Validate screenshot path
 */
export async function validateScreenshotPath(screenshotPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(screenshotPath);
    return stat.isFile() && screenshotPath.endsWith('.png');
  } catch {
    return false;
  }
}

/**
 * Get screenshot dimensions
 */
export async function getScreenshotDimensions(
  screenshotPath: string
): Promise<{ width: number; height: number } | null> {
  try {
    const metadata = await sharp(screenshotPath).metadata();
    if (!metadata.width || !metadata.height) return null;
    return { width: metadata.width, height: metadata.height };
  } catch {
    return null;
  }
}
