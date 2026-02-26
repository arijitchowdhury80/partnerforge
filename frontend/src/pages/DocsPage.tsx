/**
 * Documentation Page
 *
 * In-app documentation viewer with navigation sidebar.
 * Fetches markdown files from GitHub and renders them.
 */

import { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  NavLink,
  Box,
  Loader,
  Badge,
  ThemeIcon,
  ScrollArea,
  Divider,
  Code,
  Anchor,
  Table,
  Alert,
  ActionIcon,
  Tooltip,
  SegmentedControl,
  Tabs,
  SimpleGrid,
  Card,
} from '@mantine/core';
import {
  IconBook,
  IconApi,
  IconDatabase,
  IconRocket,
  IconAlertCircle,
  IconSchema,
  IconServer,
  IconBuildingSkyscraper,
  IconExternalLink,
  IconCopy,
  IconCheck,
  IconRefresh,
  IconChartDots,
  IconBolt,
  IconTestPipe,
  IconUsers,
  IconCpu,
  IconBrain,
  IconFileCode,
  IconList,
} from '@tabler/icons-react';
import { useSearchParams } from 'react-router-dom';

// =============================================================================
// Types
// =============================================================================

interface DocSection {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
  children?: DocSection[];
}

// =============================================================================
// Documentation Navigation Structure
// =============================================================================

const docSections: DocSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: IconBook,
    path: 'docs/README.md',
  },
  {
    id: 'quickstart',
    label: 'Quickstart',
    icon: IconRocket,
    path: 'docs/guides/quickstart.md',
  },
  {
    id: 'api',
    label: 'API Reference',
    icon: IconApi,
    path: 'docs/api/README.md',
    children: [
      { id: 'targets', label: 'Targets', icon: IconServer, path: 'docs/api/endpoints/targets.md' },
      { id: 'enrichment', label: 'Enrichment', icon: IconServer, path: 'docs/api/endpoints/enrichment.md' },
      { id: 'health', label: 'Health', icon: IconServer, path: 'docs/api/endpoints/health.md' },
      { id: 'schemas', label: 'Schemas', icon: IconSchema, path: 'docs/api/schemas.md' },
      { id: 'errors', label: 'Errors', icon: IconAlertCircle, path: 'docs/api/errors.md' },
    ],
  },
  {
    id: 'architecture',
    label: 'Architecture',
    icon: IconBuildingSkyscraper,
    path: 'docs/ARCHITECTURE_INDEX.md',
    children: [
      { id: 'diagrams', label: 'Diagrams (Mermaid)', icon: IconChartDots, path: 'docs/architecture/diagrams.md' },
      { id: 'system-overview', label: 'System Overview', icon: IconCpu, path: 'docs/architecture/overview.md' },
      { id: 'database', label: 'Database Schema', icon: IconDatabase, path: 'docs/architecture/database.md' },
      { id: 'parallel-execution', label: 'Parallel Execution', icon: IconBolt, path: 'docs/PARALLEL_EXECUTION_ARCHITECTURE.md' },
      { id: 'enterprise-arch', label: 'Enterprise Architecture', icon: IconBuildingSkyscraper, path: 'docs/ENTERPRISE-ARCHITECTURE.md' },
    ],
  },
  {
    id: 'modules',
    label: 'Intelligence Modules',
    icon: IconBrain,
    path: 'docs/INTELLIGENCE_MODULES_SPEC.md',
    children: [
      { id: 'module-taxonomy', label: 'Module Taxonomy', icon: IconList, path: 'docs/INTELLIGENCE-MODULE-TAXONOMY.md' },
      { id: 'data-model', label: 'Data Model', icon: IconDatabase, path: 'docs/INTELLIGENCE_DATA_MODEL.md' },
      { id: 'orchestrator', label: 'Orchestrator Design', icon: IconCpu, path: 'docs/ORCHESTRATOR_DESIGN.md' },
    ],
  },
  {
    id: 'testing',
    label: 'Testing & Quality',
    icon: IconTestPipe,
    path: 'docs/TESTING_ARCHITECTURE.md',
    children: [
      { id: 'testing-methodology', label: 'Methodology', icon: IconFileCode, path: 'docs/TESTING_METHODOLOGY.md' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: IconUsers,
    path: 'docs/OBSERVABILITY_METRICS.md',
    children: [
      { id: 'multi-tenancy', label: 'Multi-Tenancy & RBAC', icon: IconUsers, path: 'docs/MULTI_TENANCY_RBAC.md' },
      { id: 'api-cost-tracking', label: 'API Cost Tracking', icon: IconChartDots, path: 'docs/API_COST_TRACKING.md' },
      { id: 'change-detection', label: 'Change Detection', icon: IconBolt, path: 'docs/CHANGE_DETECTION_ARCHITECTURE.md' },
    ],
  },
];

// =============================================================================
// Mermaid Diagram Renderer using mermaid.ink
// =============================================================================

/**
 * Renders Mermaid diagrams using the mermaid.ink service
 * No custom theme - uses mermaid defaults for reliability
 */
function MermaidDiagram({ code, index }: { code: string; index: number }) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  // Clean up the mermaid code (no theme injection)
  const cleanCode = code.trim();

  // Base64 encoding with UTF-8 support (handles emojis and special characters)
  let base64: string;
  try {
    base64 = btoa(unescape(encodeURIComponent(cleanCode)));
  } catch {
    // If encoding fails, show fallback
    return (
      <Paper key={`mermaid-${index}`} p="md" bg="dark.8" radius="md" my="md" style={{ overflow: 'auto' }}>
        <Group justify="space-between" mb="xs">
          <Badge size="sm" color="yellow" variant="light">Mermaid (encoding error)</Badge>
        </Group>
        <Code block style={{ whiteSpace: 'pre', fontSize: '13px' }}>
          {cleanCode}
        </Code>
      </Paper>
    );
  }
  const imageUrl = `https://mermaid.ink/img/${base64}`;

  if (error) {
    // Fallback to showing code if image fails to load
    return (
      <Paper key={`mermaid-${index}`} p="md" bg="dark.8" radius="md" my="md" style={{ overflow: 'auto' }}>
        <Group justify="space-between" mb="xs">
          <Badge size="sm" color="yellow" variant="light">Mermaid (view on GitHub)</Badge>
          <Anchor
            href="https://github.com/arijitchowdhury80/partnerforge/blob/main/docs/architecture/diagrams.md"
            target="_blank"
            size="xs"
            c="dimmed"
          >
            <Group gap={4}>
              <IconExternalLink size={12} />
              View on GitHub
            </Group>
          </Anchor>
        </Group>
        <Code block style={{ whiteSpace: 'pre', fontSize: '13px' }}>
          {cleanCode}
        </Code>
      </Paper>
    );
  }

  return (
    <Paper
      key={`mermaid-${index}`}
      p="md"
      bg="dark.8"
      radius="md"
      my="md"
      style={{ overflow: 'auto', textAlign: 'center' }}
    >
      <Group justify="space-between" mb="sm">
        <Badge size="sm" color="blue" variant="light">
          {loading ? 'Loading...' : 'Mermaid Diagram'}
        </Badge>
        <Anchor
          href={imageUrl}
          target="_blank"
          size="xs"
          c="dimmed"
        >
          <Group gap={4}>
            <IconExternalLink size={12} />
            Open full size
          </Group>
        </Anchor>
      </Group>
      <img
        src={imageUrl}
        alt="Mermaid diagram"
        style={{
          maxWidth: '100%',
          height: 'auto',
          borderRadius: 'var(--mantine-radius-sm)',
        }}
        onLoad={() => setLoading(false)}
        onError={() => setError(true)}
      />
    </Paper>
  );
}

// =============================================================================
// Diagram Gallery - Organized view for multiple mermaid diagrams
// =============================================================================

interface DiagramInfo {
  title: string;
  code: string;
  category: 'architecture' | 'data' | 'execution' | 'components';
}

const DIAGRAM_CATEGORIES = {
  architecture: { label: 'System Architecture', icon: '🏗️' },
  data: { label: 'Data & Processing', icon: '📊' },
  execution: { label: 'Execution & State', icon: '⚡' },
  components: { label: 'Components', icon: '🧩' },
};

// Categorize diagrams by their titles
function categorizeDiagram(title: string): DiagramInfo['category'] {
  const lower = title.toLowerCase();
  if (lower.includes('system overview') || lower.includes('deployment') || lower.includes('architecture')) {
    return 'architecture';
  }
  if (lower.includes('data flow') || lower.includes('icp') || lower.includes('database') || lower.includes('module dependency')) {
    return 'data';
  }
  if (lower.includes('wave') || lower.includes('state') || lower.includes('circuit') || lower.includes('enrichment')) {
    return 'execution';
  }
  return 'components';
}

// Parse markdown to extract diagrams with their titles
function extractDiagrams(markdown: string): DiagramInfo[] {
  const diagrams: DiagramInfo[] = [];
  const lines = markdown.split('\n');
  let currentTitle = '';
  let inMermaid = false;
  let mermaidCode: string[] = [];

  for (const line of lines) {
    // Capture section titles (## headers)
    if (line.startsWith('## ')) {
      currentTitle = line.slice(3).trim();
    }
    // Start of mermaid block
    else if (line.trim() === '```mermaid') {
      inMermaid = true;
      mermaidCode = [];
    }
    // End of mermaid block
    else if (inMermaid && line.trim() === '```') {
      inMermaid = false;
      if (mermaidCode.length > 0) {
        diagrams.push({
          title: currentTitle || `Diagram ${diagrams.length + 1}`,
          code: mermaidCode.join('\n'),
          category: categorizeDiagram(currentTitle),
        });
      }
    }
    // Inside mermaid block
    else if (inMermaid) {
      mermaidCode.push(line);
    }
  }

  return diagrams;
}

// Glassmorphism card styles
const glassCardStyle = {
  background: 'linear-gradient(135deg, rgba(0,61,255,0.08) 0%, rgba(84,104,255,0.04) 100%)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(84,104,255,0.2)',
  boxShadow: '0 8px 32px rgba(0,61,255,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  cursor: 'pointer',
};

const glassCardHoverStyle = {
  transform: 'translateY(-4px) scale(1.02)',
  boxShadow: '0 20px 60px rgba(0,61,255,0.3), 0 0 40px rgba(84,104,255,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
  border: '1px solid rgba(84,104,255,0.4)',
};

function DiagramGallery({ markdown }: { markdown: string }) {
  const [activeTab, setActiveTab] = useState<string>('architecture');
  const [selectedDiagram, setSelectedDiagram] = useState<DiagramInfo | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const diagrams = extractDiagrams(markdown);
  const categorized = diagrams.reduce((acc, d) => {
    if (!acc[d.category]) acc[d.category] = [];
    acc[d.category].push(d);
    return acc;
  }, {} as Record<string, DiagramInfo[]>);

  if (selectedDiagram) {
    return (
      <Box>
        <Group mb="md">
          <ActionIcon
            variant="light"
            color="blue"
            size="lg"
            radius="xl"
            onClick={() => setSelectedDiagram(null)}
            style={{
              boxShadow: '0 4px 20px rgba(0,61,255,0.3)',
            }}
          >
            ←
          </ActionIcon>
          <Title order={3} style={{ color: '#fff' }}>{selectedDiagram.title}</Title>
        </Group>
        <Paper
          p="lg"
          radius="lg"
          style={{
            background: 'linear-gradient(180deg, rgba(0,61,255,0.05) 0%, rgba(26,27,30,0.9) 100%)',
            border: '1px solid rgba(84,104,255,0.2)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 100px rgba(0,61,255,0.1)',
          }}
        >
          <MermaidDiagram code={selectedDiagram.code} index={0} />
        </Paper>
      </Box>
    );
  }

  // If no diagrams found, show helpful message
  if (diagrams.length === 0) {
    return (
      <Box>
        <Alert icon={<IconAlertCircle size={16} />} title="No Diagrams Found" color="yellow">
          No mermaid diagrams were extracted from this page. This may be a parsing issue.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Hero Header with Glow */}
      <Paper
        p="xl"
        mb="xl"
        radius="lg"
        style={{
          background: 'linear-gradient(135deg, rgba(0,61,255,0.15) 0%, rgba(84,104,255,0.08) 50%, rgba(0,61,255,0.05) 100%)',
          border: '1px solid rgba(84,104,255,0.3)',
          boxShadow: '0 8px 40px rgba(0,61,255,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow orb effect */}
        <Box
          style={{
            position: 'absolute',
            top: -50,
            right: -50,
            width: 200,
            height: 200,
            background: 'radial-gradient(circle, rgba(0,61,255,0.3) 0%, transparent 70%)',
            filter: 'blur(40px)',
            pointerEvents: 'none',
          }}
        />
        <Group justify="space-between" style={{ position: 'relative', zIndex: 1 }}>
          <Group>
            <ThemeIcon
              size={56}
              radius="xl"
              variant="gradient"
              gradient={{ from: '#003dff', to: '#5468ff', deg: 135 }}
              style={{ boxShadow: '0 8px 24px rgba(0,61,255,0.4)' }}
            >
              <IconChartDots size={28} />
            </ThemeIcon>
            <div>
              <Title order={2} style={{ color: '#fff', textShadow: '0 2px 20px rgba(0,61,255,0.3)' }}>
                Architecture Diagrams
              </Title>
              <Text size="sm" c="dimmed">
                {diagrams.length} diagrams across {Object.keys(categorized).filter(k => (categorized[k]?.length || 0) > 0).length} categories
              </Text>
            </div>
          </Group>
          <Badge
            size="xl"
            variant="gradient"
            gradient={{ from: '#003dff', to: '#5468ff', deg: 135 }}
            style={{ boxShadow: '0 4px 20px rgba(0,61,255,0.3)' }}
          >
            Gallery View
          </Badge>
        </Group>
      </Paper>

      {/* Tabs with Glow */}
      <Tabs value={activeTab} onChange={(v) => setActiveTab(v || 'architecture')}>
        <Tabs.List
          mb="xl"
          style={{
            background: 'rgba(0,0,0,0.3)',
            borderRadius: 'var(--mantine-radius-lg)',
            padding: 4,
            border: '1px solid rgba(84,104,255,0.15)',
          }}
        >
          {Object.entries(DIAGRAM_CATEGORIES).map(([key, { label, icon }]) => (
            <Tabs.Tab
              key={key}
              value={key}
              leftSection={<span style={{ fontSize: 18 }}>{icon}</span>}
              style={{
                fontWeight: 500,
                transition: 'all 0.2s',
                ...(activeTab === key ? {
                  background: 'linear-gradient(135deg, #003dff, #5468ff)',
                  boxShadow: '0 4px 20px rgba(0,61,255,0.4)',
                  color: '#fff',
                } : {}),
              }}
            >
              {label} ({categorized[key]?.length || 0})
            </Tabs.Tab>
          ))}
        </Tabs.List>

        {Object.entries(DIAGRAM_CATEGORIES).map(([key]) => (
          <Tabs.Panel key={key} value={key}>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
              {(categorized[key] || []).map((diagram, idx) => {
                const globalIdx = `${key}-${idx}`;
                const isHovered = hoveredIdx === idx;
                return (
                  <Card
                    key={idx}
                    padding={0}
                    radius="lg"
                    style={{
                      ...glassCardStyle,
                      ...(isHovered ? glassCardHoverStyle : {}),
                      overflow: 'hidden',
                    }}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    onClick={() => setSelectedDiagram(diagram)}
                  >
                    {/* Diagram Preview with Gradient Overlay */}
                    <Box
                      style={{
                        height: 160,
                        overflow: 'hidden',
                        position: 'relative',
                        background: 'linear-gradient(180deg, rgba(0,61,255,0.1) 0%, rgba(26,27,30,0.95) 100%)',
                      }}
                    >
                      <Box
                        style={{
                          transform: 'scale(0.3)',
                          transformOrigin: 'top center',
                          width: '333%',
                          marginLeft: '-116.5%',
                          paddingTop: 20,
                        }}
                      >
                        <MermaidDiagram code={diagram.code} index={idx} />
                      </Box>
                      {/* Gradient fade */}
                      <Box
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(180deg, transparent 40%, rgba(26,27,30,0.98) 100%)',
                          pointerEvents: 'none',
                        }}
                      />
                      {/* Glow effect on hover */}
                      {isHovered && (
                        <Box
                          style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'radial-gradient(ellipse at center, rgba(0,61,255,0.15) 0%, transparent 70%)',
                            pointerEvents: 'none',
                          }}
                        />
                      )}
                    </Box>
                    {/* Card Footer */}
                    <Box p="md">
                      <Group justify="space-between" align="center">
                        <Text
                          fw={600}
                          size="sm"
                          lineClamp={1}
                          style={{
                            color: isHovered ? '#fff' : 'var(--mantine-color-gray-3)',
                            transition: 'color 0.2s',
                          }}
                        >
                          {diagram.title}
                        </Text>
                        <Badge
                          size="sm"
                          variant={isHovered ? 'gradient' : 'light'}
                          gradient={{ from: '#003dff', to: '#5468ff' }}
                          style={{
                            boxShadow: isHovered ? '0 2px 12px rgba(0,61,255,0.4)' : 'none',
                            transition: 'all 0.2s',
                          }}
                        >
                          {isHovered ? 'Click to View' : 'View'}
                        </Badge>
                      </Group>
                    </Box>
                  </Card>
                );
              })}
            </SimpleGrid>
          </Tabs.Panel>
        ))}
      </Tabs>
    </Box>
  );
}

// =============================================================================
// Markdown Renderer (Simple)
// =============================================================================

function renderMarkdown(markdown: string): JSX.Element[] {
  const lines = markdown.split('\n');
  const elements: JSX.Element[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLang = '';
  let inTable = false;
  let tableRows: string[][] = [];
  let tableHeaders: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // Check if this is a Mermaid diagram
        if (codeBlockLang === 'mermaid') {
          elements.push(
            <MermaidDiagram key={`mermaid-${i}`} code={codeBlockContent.join('\n')} index={i} />
          );
        } else {
          elements.push(
            <Paper key={`code-${i}`} p="md" bg="dark.8" radius="md" my="md" style={{ overflow: 'auto' }}>
              {codeBlockLang && (
                <Badge size="xs" mb="xs" variant="light">{codeBlockLang}</Badge>
              )}
              <Code block style={{ whiteSpace: 'pre', fontSize: '13px' }}>
                {codeBlockContent.join('\n')}
              </Code>
            </Paper>
          );
        }
        codeBlockContent = [];
        codeBlockLang = '';
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeBlockLang = line.replace('```', '').trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Tables
    if (line.includes('|') && line.trim().startsWith('|')) {
      const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());

      if (!inTable) {
        inTable = true;
        tableHeaders = cells;
        continue;
      }

      // Skip separator line
      if (cells.every(c => c.match(/^[-:]+$/))) {
        continue;
      }

      tableRows.push(cells);
      continue;
    } else if (inTable) {
      // End of table
      elements.push(
        <Paper key={`table-${i}`} withBorder radius="md" my="md" style={{ overflow: 'auto' }}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                {tableHeaders.map((h, idx) => (
                  <Table.Th key={idx}>{h}</Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {tableRows.map((row, ridx) => (
                <Table.Tr key={ridx}>
                  {row.map((cell, cidx) => (
                    <Table.Td key={cidx}>
                      {cell.startsWith('`') && cell.endsWith('`') ? (
                        <Code>{cell.slice(1, -1)}</Code>
                      ) : (
                        cell
                      )}
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      );
      inTable = false;
      tableRows = [];
      tableHeaders = [];
    }

    // Empty lines
    if (!line.trim()) {
      continue;
    }

    // Headers
    if (line.startsWith('# ')) {
      elements.push(
        <Title key={i} order={1} mt="xl" mb="md" style={{ color: 'var(--mantine-color-blue-4)' }}>
          {line.slice(2)}
        </Title>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <Title key={i} order={2} mt="lg" mb="sm">
          {line.slice(3)}
        </Title>
      );
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(
        <Title key={i} order={3} mt="md" mb="xs" size="h4">
          {line.slice(4)}
        </Title>
      );
      continue;
    }
    if (line.startsWith('#### ')) {
      elements.push(
        <Title key={i} order={4} mt="sm" mb="xs" size="h5" c="dimmed">
          {line.slice(5)}
        </Title>
      );
      continue;
    }

    // Horizontal rules
    if (line.match(/^-{3,}$/)) {
      elements.push(<Divider key={i} my="lg" />);
      continue;
    }

    // List items
    if (line.match(/^[-*] /)) {
      elements.push(
        <Text key={i} component="li" ml="lg" my={4}>
          {renderInlineMarkdown(line.slice(2))}
        </Text>
      );
      continue;
    }

    // Numbered lists
    if (line.match(/^\d+\. /)) {
      const text = line.replace(/^\d+\. /, '');
      elements.push(
        <Text key={i} component="li" ml="lg" my={4}>
          {renderInlineMarkdown(text)}
        </Text>
      );
      continue;
    }

    // Regular paragraphs
    elements.push(
      <Text key={i} my="xs" style={{ lineHeight: 1.7 }}>
        {renderInlineMarkdown(line)}
      </Text>
    );
  }

  return elements;
}

function renderInlineMarkdown(text: string): React.ReactNode {
  // Handle inline code
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <Code key={i}>{part.slice(1, -1)}</Code>;
    }
    // Handle bold
    if (part.includes('**')) {
      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((bp, j) => {
        if (bp.startsWith('**') && bp.endsWith('**')) {
          return <Text key={`${i}-${j}`} component="span" fw={700}>{bp.slice(2, -2)}</Text>;
        }
        return bp;
      });
    }
    // Handle links
    const linkMatch = part.match(/\[([^\]]+)\]\(([^)]+)\)/g);
    if (linkMatch) {
      let result = part;
      linkMatch.forEach(match => {
        const [, label, url] = match.match(/\[([^\]]+)\]\(([^)]+)\)/) || [];
        result = result.replace(match, `|||LINK:${label}:${url}|||`);
      });
      return result.split('|||').map((segment, j) => {
        if (segment.startsWith('LINK:')) {
          const [, label, url] = segment.match(/LINK:(.+):(.+)/) || [];
          return (
            <Anchor key={`${i}-${j}`} href={url} target="_blank" rel="noopener">
              {label}
            </Anchor>
          );
        }
        return segment;
      });
    }
    return part;
  });
}

// =============================================================================
// Main Component
// =============================================================================

export function DocsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState(searchParams.get('section') || 'overview');

  // Find current section
  const findSection = (sections: DocSection[], id: string): DocSection | null => {
    for (const section of sections) {
      if (section.id === id) return section;
      if (section.children) {
        const found = findSection(section.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const currentSection = findSection(docSections, activeSection) || docSections[0];

  // Fetch markdown content
  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch from GitHub raw content
        const url = `https://raw.githubusercontent.com/arijitchowdhury80/partnerforge/main/${currentSection.path}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`);
        }

        const text = await response.text();
        setContent(text);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load documentation');
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [currentSection.path]);

  // Handle section change
  const handleSectionChange = (sectionId: string) => {
    setActiveSection(sectionId);
    setSearchParams({ section: sectionId });
  };

  // Copy URL
  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Render nav items recursively
  const renderNavItems = (sections: DocSection[], level = 0) => {
    return sections.map((section) => (
      <Box key={section.id}>
        <NavLink
          label={section.label}
          leftSection={
            <ThemeIcon variant="light" size="sm" color={activeSection === section.id ? 'blue' : 'gray'}>
              <section.icon size={14} />
            </ThemeIcon>
          }
          active={activeSection === section.id}
          onClick={() => handleSectionChange(section.id)}
          style={{
            paddingLeft: level * 16,
            borderRadius: 'var(--mantine-radius-sm)',
          }}
        />
        {section.children && (
          <Box ml="md">
            {renderNavItems(section.children, level + 1)}
          </Box>
        )}
      </Box>
    ));
  };

  return (
    <Container size="xl" py="xl">
      <Group align="flex-start" gap="xl">
        {/* Sidebar Navigation */}
        <Paper
          p="md"
          radius="md"
          withBorder
          style={{
            width: 260,
            position: 'sticky',
            top: 20,
            maxHeight: 'calc(100vh - 120px)',
            overflow: 'auto',
          }}
        >
          <Group justify="space-between" mb="md">
            <Title order={4}>Documentation</Title>
            <Badge size="sm" variant="light">v2.2.0</Badge>
          </Group>
          <Divider mb="md" />
          <Stack gap={4}>
            {renderNavItems(docSections)}
          </Stack>

          <Divider my="md" />

          {/* Quick Links */}
          <Text size="xs" fw={500} c="dimmed" mb="xs">External Links</Text>
          <Stack gap={4}>
            <Anchor
              href="https://github.com/arijitchowdhury80/partnerforge"
              target="_blank"
              size="sm"
              c="dimmed"
            >
              <Group gap={4}>
                <IconExternalLink size={14} />
                GitHub Repository
              </Group>
            </Anchor>
            <Anchor
              href="https://partnerforge-production.up.railway.app/docs"
              target="_blank"
              size="sm"
              c="dimmed"
            >
              <Group gap={4}>
                <IconExternalLink size={14} />
                OpenAPI Docs
              </Group>
            </Anchor>
          </Stack>
        </Paper>

        {/* Content Area */}
        <Box style={{ flex: 1, minWidth: 0 }}>
          {/* Header */}
          <Paper p="md" radius="md" mb="lg" withBorder>
            <Group justify="space-between">
              <Group>
                <ThemeIcon size="lg" variant="light" color="blue">
                  <currentSection.icon size={20} />
                </ThemeIcon>
                <div>
                  <Title order={3}>{currentSection.label}</Title>
                  <Text size="sm" c="dimmed">{currentSection.path}</Text>
                </div>
              </Group>
              <Group>
                <Tooltip label={copied ? 'Copied!' : 'Copy link'}>
                  <ActionIcon variant="subtle" onClick={handleCopyUrl}>
                    {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Refresh">
                  <ActionIcon variant="subtle" onClick={() => setLoading(true)}>
                    <IconRefresh size={16} />
                  </ActionIcon>
                </Tooltip>
                <Anchor
                  href={`https://github.com/arijitchowdhury80/partnerforge/blob/main/${currentSection.path}`}
                  target="_blank"
                >
                  <ActionIcon variant="subtle">
                    <IconExternalLink size={16} />
                  </ActionIcon>
                </Anchor>
              </Group>
            </Group>
          </Paper>

          {/* Content */}
          <Paper p="xl" radius="md" withBorder>
            {loading ? (
              <Stack align="center" py="xl">
                <Loader size="lg" />
                <Text c="dimmed">Loading documentation...</Text>
              </Stack>
            ) : error ? (
              <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
                {error}
              </Alert>
            ) : activeSection === 'diagrams' ? (
              /* Direct gallery render for diagrams page */
              <DiagramGallery markdown={content} />
            ) : (
              <Box className="markdown-content">
                {renderMarkdown(content)}
              </Box>
            )}
          </Paper>
        </Box>
      </Group>
    </Container>
  );
}
