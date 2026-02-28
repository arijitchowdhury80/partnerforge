/**
 * ICPMindMap - Interactive React Flow visualization of Algolia's ICP
 * Click nodes to drill down: Center → Industry → Companies → Evidence
 */

import { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  NodeProps,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Box, Paper, Text, Badge, Group, Stack, RingProgress } from '@mantine/core';
import { IconBuilding, IconQuote, IconExternalLink } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { COLORS } from '@/lib/constants';
import customerEvidenceData from '@/data/customerEvidence.json';
import { CustomerEvidence, CustomerEvidenceData, INDUSTRY_CONFIG, IndustryData } from '@/data/customerEvidenceTypes';

const data = customerEvidenceData as CustomerEvidenceData;

// =============================================================================
// Custom Node Components
// =============================================================================

// Center Hub Node
function CenterNode({ data }: NodeProps) {
  return (
    <Paper
      p="lg"
      radius="xl"
      withBorder
      style={{
        background: `linear-gradient(135deg, ${COLORS.ALGOLIA_NEBULA_BLUE}, ${COLORS.ALGOLIA_PURPLE})`,
        borderWidth: 3,
        borderColor: 'white',
        cursor: 'pointer',
        minWidth: 180,
        textAlign: 'center',
        boxShadow: `0 8px 32px ${COLORS.ALGOLIA_NEBULA_BLUE}40`,
      }}
    >
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Text c="white" fw={800} size="lg">ALGOLIA ICP</Text>
      <Text c="white" size="sm" opacity={0.9}>Data-Derived</Text>
      <Badge mt="xs" color="white" variant="light" size="lg">
        {data.stats.totalCompanies} Companies
      </Badge>
    </Paper>
  );
}

// Industry Node
function IndustryNode({ data }: NodeProps<IndustryData>) {
  const config = INDUSTRY_CONFIG[data.name] || INDUSTRY_CONFIG['Other'];

  return (
    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
      <Paper
        p="md"
        radius="lg"
        withBorder
        style={{
          background: `linear-gradient(135deg, white, ${config.color}10)`,
          borderColor: config.color,
          borderWidth: 2,
          cursor: 'pointer',
          minWidth: 150,
          textAlign: 'center',
        }}
      >
        <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
        <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />

        <Badge color={config.color} variant="light" size="sm" mb="xs">
          {config.confidence}
        </Badge>
        <Text fw={700} size="sm" c={config.color}>{data.name}</Text>
        <Text size="xs" c="dimmed">{data.count} companies</Text>
        {config.proofPoints > 0 && (
          <Text size="xs" c={config.color} fw={600}>
            {config.proofPoints} proof points
          </Text>
        )}
      </Paper>
    </motion.div>
  );
}

// Company Node
function CompanyNode({ data }: NodeProps<CustomerEvidence>) {
  return (
    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
      <Paper
        p="sm"
        radius="md"
        withBorder
        style={{
          cursor: 'pointer',
          minWidth: 120,
          textAlign: 'center',
          background: data.storyUrl ? 'linear-gradient(135deg, white, #e0f2fe)' : 'white',
          borderColor: data.storyUrl ? '#0ea5e9' : '#e2e8f0',
        }}
      >
        <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />

        <Group gap={4} justify="center" mb={4}>
          <IconBuilding size={14} color="#64748b" />
          <Text fw={600} size="xs" lineClamp={1}>{data.company}</Text>
        </Group>

        <Group gap={4} justify="center">
          {data.quotes.length > 0 && (
            <Badge size="xs" variant="light" color="violet" leftSection={<IconQuote size={10} />}>
              {data.quotes.length}
            </Badge>
          )}
          {data.storyUrl && (
            <Badge size="xs" variant="light" color="blue" leftSection={<IconExternalLink size={10} />}>
              Story
            </Badge>
          )}
        </Group>
      </Paper>
    </motion.div>
  );
}

// Node types mapping
const nodeTypes = {
  center: CenterNode,
  industry: IndustryNode,
  company: CompanyNode,
};

// =============================================================================
// Main Component
// =============================================================================

interface ICPMindMapProps {
  onSelectCompany: (company: CustomerEvidence) => void;
  onSelectIndustry: (industry: IndustryData) => void;
}

export function ICPMindMap({ onSelectCompany, onSelectIndustry }: ICPMindMapProps) {
  const [expandedIndustry, setExpandedIndustry] = useState<string | null>(null);

  // Process data into industries
  const industries = useMemo(() => {
    const industryMap: Record<string, CustomerEvidence[]> = {};

    data.companies.forEach((company) => {
      const ind = company.industry.toLowerCase();
      let key = 'Other';

      if (ind.includes('fashion') || ind.includes('clothing') || ind.includes('apparel')) {
        key = 'Fashion/Apparel';
      } else if (ind.includes('grocery') || ind.includes('food')) {
        key = 'Grocery/Food';
      } else if (ind.includes('saas') || ind.includes('software')) {
        key = 'SaaS';
      } else if (ind.includes('b2b')) {
        key = 'B2B E-commerce';
      } else if (ind.includes('media')) {
        key = 'Media/Publishing';
      } else if (ind.includes('retail') || ind.includes('e-comm') || ind.includes('ecomm')) {
        key = 'Retail E-commerce';
      }

      if (!industryMap[key]) industryMap[key] = [];
      industryMap[key].push(company);
    });

    return Object.entries(industryMap)
      .map(([name, companies]) => {
        const config = INDUSTRY_CONFIG[name] || INDUSTRY_CONFIG['Other'];
        return {
          id: name.toLowerCase().replace(/[^a-z]/g, '-'),
          name,
          count: companies.length,
          companies: companies.sort((a, b) => b.quotes.length - a.quotes.length),
          confidence: config.confidence,
          proofPoints: config.proofPoints,
          color: config.color,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, []);

  // Generate nodes and edges
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Center node
    nodes.push({
      id: 'center',
      type: 'center',
      position: { x: 400, y: 0 },
      data: { stats: data.stats },
    });

    // Industry nodes in a semi-circle
    const industryRadius = 200;
    const angleStep = Math.PI / (industries.length + 1);

    industries.forEach((industry, i) => {
      const angle = -Math.PI / 2 + angleStep * (i + 1);
      const x = 400 + Math.cos(angle) * industryRadius * 1.5;
      const y = 120 + Math.sin(angle) * industryRadius * 0.5 + 100;

      nodes.push({
        id: industry.id,
        type: 'industry',
        position: { x, y },
        data: industry,
      });

      edges.push({
        id: `center-${industry.id}`,
        source: 'center',
        target: industry.id,
        style: { stroke: INDUSTRY_CONFIG[industry.name]?.color || '#64748b', strokeWidth: 2 },
        animated: true,
      });

      // If this industry is expanded, show its companies
      if (expandedIndustry === industry.id) {
        const maxCompanies = 8;
        const companiesToShow = industry.companies.slice(0, maxCompanies);
        const companyRadius = 150;
        const companyAngleStep = Math.PI / (companiesToShow.length + 1);

        companiesToShow.forEach((company, j) => {
          const companyAngle = companyAngleStep * (j + 1);
          const cx = x + Math.cos(companyAngle) * companyRadius - 60;
          const cy = y + 100 + Math.sin(companyAngle) * companyRadius * 0.3;

          nodes.push({
            id: `company-${company.company.toLowerCase().replace(/[^a-z]/g, '-')}`,
            type: 'company',
            position: { x: cx, y: cy },
            data: company,
          });

          edges.push({
            id: `${industry.id}-${company.company}`,
            source: industry.id,
            target: `company-${company.company.toLowerCase().replace(/[^a-z]/g, '-')}`,
            style: { stroke: INDUSTRY_CONFIG[industry.name]?.color || '#64748b', strokeWidth: 1 },
          });
        });
      }
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [industries, expandedIndustry]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when expandedIndustry changes
  useMemo(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Handle node clicks
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === 'industry') {
        const industry = industries.find((i) => i.id === node.id);
        if (industry) {
          if (expandedIndustry === node.id) {
            setExpandedIndustry(null);
          } else {
            setExpandedIndustry(node.id);
            onSelectIndustry(industry);
          }
        }
      } else if (node.type === 'company') {
        onSelectCompany(node.data as CustomerEvidence);
      }
    },
    [expandedIndustry, industries, onSelectCompany, onSelectIndustry]
  );

  return (
    <Box style={{ width: '100%', height: 500 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.5}
        maxZoom={1.5}
        attributionPosition="bottom-left"
      >
        <Background color="#e2e8f0" gap={20} />
        <Controls position="top-right" />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'center') return COLORS.ALGOLIA_NEBULA_BLUE;
            if (node.type === 'industry') {
              const config = INDUSTRY_CONFIG[(node.data as IndustryData)?.name];
              return config?.color || '#64748b';
            }
            return '#94a3b8';
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
    </Box>
  );
}
