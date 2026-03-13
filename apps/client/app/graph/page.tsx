'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchGraphDashboard,
  fetchGraphPersonas,
  getGraphRuntimeLearnerId,
  type CityId,
  type GraphDashboardResponse,
  type GraphPackEdge,
  type GraphPersonaSummary,
  type GraphSelectedPackNode,
  type LocationId,
} from '@/lib/api';

const GRAPH_WIDTH = 1320;
const GRAPH_HEIGHT = 860;
const LEVEL_MARGIN_X = 148;
const LEVEL_MARGIN_Y = 112;

const CITY_OPTIONS: Array<{ id: CityId; label: string }> = [
  { id: 'seoul', label: 'Seoul' },
  { id: 'tokyo', label: 'Tokyo' },
  { id: 'shanghai', label: 'Shanghai' },
];

const LOCATION_OPTIONS: Array<{ id: LocationId; label: string }> = [
  { id: 'food_street', label: 'Food Street' },
  { id: 'cafe', label: 'Cafe' },
  { id: 'convenience_store', label: 'Convenience Store' },
  { id: 'subway_hub', label: 'Subway Hub' },
  { id: 'practice_studio', label: 'Practice Studio' },
];

const GRAPH_LEVEL_BANDS = [
  { level: 0, label: 'Script' },
  { level: 1, label: 'Pronunciation' },
  { level: 2, label: 'Vocabulary' },
  { level: 3, label: 'Grammar' },
  { level: 4, label: 'Sentences' },
  { level: 5, label: 'Conversation' },
  { level: 6, label: 'Mastery' },
] as const;

const STATUS_TONES: Record<
  GraphSelectedPackNode['state']['status'],
  { fill: string; stroke: string; ink: string }
> = {
  locked: { fill: '#f5efe7', stroke: '#c7b39d', ink: '#7b654d' },
  available: { fill: '#ffe2cf', stroke: '#ff9d61', ink: '#7f3009' },
  learning: { fill: '#ffe8d8', stroke: '#ff7c43', ink: '#8b3c13' },
  due: { fill: '#fff4bf', stroke: '#f0c447', ink: '#7b5900' },
  validated: { fill: '#d8fbef', stroke: '#2fa17d', ink: '#0d5d49' },
  mastered: { fill: '#dcefff', stroke: '#4b88e6', ink: '#123f7c' },
};

const CATEGORY_TONES: Record<string, string> = {
  script: '#ff8a4c',
  pronunciation: '#f05d5e',
  vocabulary: '#1f9f87',
  grammar: '#6b56f5',
  sentences: '#4569d4',
  conversation: '#0f766e',
  mastery: '#111827',
};

const EDGE_TONES: Record<GraphPackEdge['type'], { stroke: string; dash?: string }> = {
  requires: { stroke: '#ff8b62' },
  unlocks: { stroke: '#20a67c' },
  reinforces: { stroke: '#7860ff', dash: '9 7' },
};

type Point = {
  x: number;
  y: number;
};

type GraphViewMode = 'curriculum' | 'dependency';

type Viewport = {
  x: number;
  y: number;
  scale: number;
};

type DragState =
  | { type: 'pan'; startX: number; startY: number; origin: Viewport }
  | { type: 'node'; nodeId: string; offsetX: number; offsetY: number };

type ValidationPreset = {
  key: string;
  label: string;
  description: string;
  expectation: string;
  learnerId?: string;
  kind: 'fresh' | 'runtime' | 'persona';
};

const VALIDATION_PERSONA_COPY: Record<
  string,
  { label: string; description: string; expectation: string }
> = {
  persona_beginner_foundation: {
    label: 'Sample beginner',
    description: 'Seeded low-evidence learner with early script progress only.',
    expectation: 'Expect lesson-first behavior and no hangout readiness.',
  },
  persona_kpop_prompting: {
    label: 'Sample hangout-ready',
    description: 'Seeded Seoul learner with enough ordering readiness for a graph hangout.',
    expectation: 'Expect grammar-tier progress and a ready hangout bundle.',
  },
  persona_mixed_progress: {
    label: 'Sample mixed progress',
    description: 'Seeded learner with active hangout evidence and partial mid-path mastery.',
    expectation: 'Expect a mid-graph state with some completed and some missing nodes.',
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hashSeed(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function buildFreshLearnerId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `learner_validation_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  }
  return `learner_validation_${Math.random().toString(36).slice(2, 14)}`;
}

function readableDate(value?: string) {
  if (!value) return 'No evidence yet';

  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function shortLabel(title: string) {
  const trimmed = title.trim();
  if (trimmed.length <= 22) return trimmed;
  return `${trimmed.slice(0, 20)}…`;
}

function countCompleted(nodes: GraphSelectedPackNode[]) {
  return nodes.filter((entry) => entry.state.status === 'validated' || entry.state.status === 'mastered').length;
}

function completionRatio(nodes: GraphSelectedPackNode[]) {
  if (nodes.length === 0) return 0;
  return countCompleted(nodes) / nodes.length;
}

function buildInitialSelection(dashboard: GraphDashboardResponse | null) {
  if (!dashboard) return null;
  const recommendationId = dashboard.recommendations.find((item) => item.foundation)?.nodeIds?.[0];
  if (
    recommendationId &&
    dashboard.selectedPack.nodes.some((entry) => entry.node.nodeId === recommendationId)
  ) {
    return recommendationId;
  }
  return dashboard.selectedPack.nodes[0]?.node.nodeId || null;
}

function getLevelX(level: number, width = GRAPH_WIDTH) {
  const bandCount = GRAPH_LEVEL_BANDS.length;
  const innerWidth = width - LEVEL_MARGIN_X * 2;
  const step = bandCount > 1 ? innerWidth / (bandCount - 1) : 0;
  return LEVEL_MARGIN_X + level * step;
}

function buildCurriculumLayout(
  nodes: GraphSelectedPackNode[],
  _edges: GraphPackEdge[],
  width: number,
  height: number,
) {
  if (nodes.length === 0) return {} as Record<string, Point>;

  const positions: Record<string, Point> = {};
  const grouped = new Map<number, GraphSelectedPackNode[]>();
  const usableHeight = height - LEVEL_MARGIN_Y * 2;

  for (const entry of nodes) {
    const list = grouped.get(entry.node.level) || [];
    list.push(entry);
    grouped.set(entry.node.level, list);
  }

  for (const band of GRAPH_LEVEL_BANDS) {
    const entries = grouped.get(band.level) || [];
    const sortedEntries = [...entries].sort((left, right) => left.node.nodeId.localeCompare(right.node.nodeId));
    const x = getLevelX(band.level, width);
    const count = sortedEntries.length;
    const gap = count > 1 ? Math.min(usableHeight / (count - 1), 124) : 0;
    const stackHeight = gap * Math.max(count - 1, 0);
    const startY = height / 2 - stackHeight / 2;

    sortedEntries.forEach((entry, index) => {
      const seed = hashSeed(entry.node.nodeId);
      const jitterX = ((seed % 36) - 18) * 0.8;
      const jitterY = (((seed >> 4) % 28) - 14) * 0.8;
      positions[entry.node.nodeId] = {
        x: x + jitterX,
        y: startY + index * gap + jitterY,
      };
    });
  }

  for (const nodeId of Object.keys(positions)) {
    positions[nodeId] = {
      x: clamp(positions[nodeId].x, 72, width - 72),
      y: clamp(positions[nodeId].y, 72, height - 72),
    };
  }

  return positions;
}

function buildDependencyLayout(
  nodes: GraphSelectedPackNode[],
  edges: GraphPackEdge[],
  width: number,
  height: number,
) {
  if (nodes.length === 0) return {} as Record<string, Point>;

  const positions: Record<string, Point> = {};
  const centerX = width / 2;
  const centerY = height / 2;
  const nodeById = new Map(nodes.map((entry) => [entry.node.nodeId, entry]));
  const degreeByNodeId = new Map(nodes.map((entry) => [entry.node.nodeId, 0]));

  for (const edge of edges) {
    degreeByNodeId.set(edge.fromNodeId, (degreeByNodeId.get(edge.fromNodeId) || 0) + 1);
    degreeByNodeId.set(edge.toNodeId, (degreeByNodeId.get(edge.toNodeId) || 0) + 1);
  }

  const grouped = new Map<number, GraphSelectedPackNode[]>();
  for (const entry of nodes) {
    const list = grouped.get(entry.node.level) || [];
    list.push(entry);
    grouped.set(entry.node.level, list);
  }

  for (const [level, entries] of grouped) {
    const sortedEntries = [...entries].sort((left, right) => {
      const degreeDelta =
        (degreeByNodeId.get(right.node.nodeId) || 0) - (degreeByNodeId.get(left.node.nodeId) || 0);
      if (degreeDelta !== 0) return degreeDelta;
      return left.node.nodeId.localeCompare(right.node.nodeId);
    });
    const radius = 130 + level * 76;
    const angleStep = (Math.PI * 2) / sortedEntries.length;
    const startAngle = ((hashSeed(`dependency-${level}`) % 360) * Math.PI) / 180;

    sortedEntries.forEach((entry, index) => {
      const angle = startAngle + angleStep * index;
      const seed = hashSeed(entry.node.nodeId);
      const jitterRadius = ((seed % 20) - 10) * 1.8;
      const jitterAngle = (((seed >> 5) % 18) - 9) * 0.012;
      const orbitalRadius = radius + jitterRadius;
      positions[entry.node.nodeId] = {
        x: centerX + Math.cos(angle + jitterAngle) * orbitalRadius,
        y: centerY + Math.sin(angle + jitterAngle) * orbitalRadius,
      };
    });
  }

  for (let iteration = 0; iteration < 180; iteration += 1) {
    const forces = new Map<string, Point>(
      nodes.map((entry) => [entry.node.nodeId, { x: 0, y: 0 }]),
    );

    for (let index = 0; index < nodes.length; index += 1) {
      const leftId = nodes[index].node.nodeId;
      const left = positions[leftId];
      if (!left) continue;

      for (let otherIndex = index + 1; otherIndex < nodes.length; otherIndex += 1) {
        const rightId = nodes[otherIndex].node.nodeId;
        const right = positions[rightId];
        if (!right) continue;

        const dx = left.x - right.x;
        const dy = left.y - right.y;
        const distance = Math.max(Math.hypot(dx, dy), 1);
        const strength = 9500 / (distance * distance);
        const fx = (dx / distance) * strength;
        const fy = (dy / distance) * strength;

        const leftForce = forces.get(leftId);
        const rightForce = forces.get(rightId);
        if (leftForce) {
          leftForce.x += fx;
          leftForce.y += fy;
        }
        if (rightForce) {
          rightForce.x -= fx;
          rightForce.y -= fy;
        }
      }
    }

    for (const edge of edges) {
      const source = positions[edge.fromNodeId];
      const target = positions[edge.toNodeId];
      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.max(Math.hypot(dx, dy), 1);
      const fromLevel = nodeById.get(edge.fromNodeId)?.node.level ?? 0;
      const toLevel = nodeById.get(edge.toNodeId)?.node.level ?? 0;
      const targetLength = 118 + Math.abs(toLevel - fromLevel) * 34;
      const strength =
        edge.type === 'reinforces' ? 0.009 : edge.type === 'unlocks' ? 0.017 : 0.013;
      const spring = (distance - targetLength) * strength;
      const fx = (dx / distance) * spring;
      const fy = (dy / distance) * spring;

      const sourceForce = forces.get(edge.fromNodeId);
      const targetForce = forces.get(edge.toNodeId);
      if (sourceForce) {
        sourceForce.x += fx;
        sourceForce.y += fy;
      }
      if (targetForce) {
        targetForce.x -= fx;
        targetForce.y -= fy;
      }
    }

    for (const entry of nodes) {
      const nodeId = entry.node.nodeId;
      const point = positions[nodeId];
      const force = forces.get(nodeId);
      if (!point || !force) continue;

      const dx = point.x - centerX;
      const dy = point.y - centerY;
      const distance = Math.max(Math.hypot(dx, dy), 1);
      const desiredRadius = 128 + entry.node.level * 78;
      const radialDelta = desiredRadius - distance;
      force.x += (dx / distance) * radialDelta * 0.028;
      force.y += (dy / distance) * radialDelta * 0.028;

      force.x -= dx * 0.0016;
      force.y -= dy * 0.0016;

      const step = Math.max(Math.hypot(force.x, force.y), 1);
      const maxStep = iteration < 48 ? 15 : 8;
      point.x = clamp(point.x + (force.x / step) * Math.min(step, maxStep), 74, width - 74);
      point.y = clamp(point.y + (force.y / step) * Math.min(step, maxStep), 74, height - 74);
    }
  }

  return positions;
}

function buildGraphLayout(
  viewMode: GraphViewMode,
  nodes: GraphSelectedPackNode[],
  edges: GraphPackEdge[],
  width: number,
  height: number,
) {
  return viewMode === 'dependency'
    ? buildDependencyLayout(nodes, edges, width, height)
    : buildCurriculumLayout(nodes, edges, width, height);
}

function edgePath(source: Point, target: Point, edgeId: string, type: GraphPackEdge['type']) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.max(Math.hypot(dx, dy), 1);
  const midpointX = (source.x + target.x) / 2;
  const midpointY = (source.y + target.y) / 2;
  const direction = hashSeed(edgeId) % 2 === 0 ? 1 : -1;
  const curvature =
    type === 'reinforces' ? 34 : type === 'unlocks' ? 22 : 14;
  const controlX = midpointX + (-dy / distance) * curvature * direction;
  const controlY = midpointY + (dx / distance) * curvature * direction;
  return `M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`;
}

function nodeRadius(entry: GraphSelectedPackNode) {
  return 10 + entry.state.masteryScore * 16 + Math.min(entry.state.evidenceCount, 7);
}

function missionStatusLabel(missionGate: GraphDashboardResponse['selectedPack']['missionGate']) {
  if (!missionGate) return 'None';
  if (missionGate.status === 'completed') return 'Completed';
  if (missionGate.status === 'ready') return 'Ready';
  return 'Blocked';
}

function missionStatusTone(missionGate: GraphDashboardResponse['selectedPack']['missionGate']) {
  if (missionGate?.status === 'completed') {
    return {
      fill: '#fde68a',
      stroke: '#d97706',
      ink: '#78350f',
      halo: '#facc15',
      edge: 'rgba(251, 191, 36, 0.92)',
    };
  }

  if (missionGate?.status === 'ready') {
    return {
      fill: '#fef3c7',
      stroke: '#f59e0b',
      ink: '#92400e',
      halo: '#fbbf24',
      edge: 'rgba(245, 158, 11, 0.86)',
    };
  }

  return {
    fill: '#f5efe7',
    stroke: '#c7b39d',
    ink: '#7b654d',
    halo: 'rgba(231, 229, 228, 0.56)',
    edge: 'rgba(199, 179, 157, 0.72)',
  };
}

export default function GraphPage() {
  const [personas, setPersonas] = useState<GraphPersonaSummary[]>([]);
  const [runtimeLearnerId, setRuntimeLearnerId] = useState('');
  const [learnerId, setLearnerId] = useState('');
  const [city, setCity] = useState<CityId>('seoul');
  const [location, setLocation] = useState<LocationId>('food_street');
  const [dashboard, setDashboard] = useState<GraphDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | GraphSelectedPackNode['state']['status']>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<GraphViewMode>('curriculum');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedMissionGate, setSelectedMissionGate] = useState(false);
  const [graphDetailOpen, setGraphDetailOpen] = useState(true);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, Point>>({});
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const [edgeVisibility, setEdgeVisibility] = useState<Record<GraphPackEdge['type'], boolean>>({
    requires: true,
    unlocks: true,
    reinforces: true,
  });
  const [snapshotCopyState, setSnapshotCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const graphRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        setLoading(true);
        setError(null);

        const params =
          typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
        const requestedLearnerId = params.get('learnerId') || params.get('personaId') || '';
        const requestedCity = params.get('city');
        const requestedLocation = params.get('location');
        const requestedView = params.get('view');
        const nextRuntimeLearnerId = getGraphRuntimeLearnerId();
        const payload = await fetchGraphPersonas();

        if (cancelled) return;

        setRuntimeLearnerId(nextRuntimeLearnerId);
        setPersonas(payload.items);
        setLearnerId(requestedLearnerId || nextRuntimeLearnerId || payload.items[0]?.learnerId || '');

        if (requestedCity === 'seoul' || requestedCity === 'tokyo' || requestedCity === 'shanghai') {
          setCity(requestedCity);
        }

        if (LOCATION_OPTIONS.some((item) => item.id === requestedLocation)) {
          setLocation(requestedLocation as LocationId);
        }

        if (requestedView === 'curriculum' || requestedView === 'dependency') {
          setViewMode(requestedView);
        }
      } catch (bootstrapError) {
        if (!cancelled) {
          setError(
            bootstrapError instanceof Error
              ? bootstrapError.message
              : 'Failed to load learner graph.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!learnerId) return;

    let cancelled = false;

    async function refresh() {
      try {
        setLoading(true);
        setError(null);

        const nextDashboard = await fetchGraphDashboard({
          learnerId,
          city,
          location,
        });

        if (cancelled) return;

        setDashboard(nextDashboard);
        setSelectedNodeId((current) => {
          if (
            current &&
            nextDashboard.selectedPack.nodes.some((entry) => entry.node.nodeId === current)
          ) {
            return current;
          }
          return buildInitialSelection(nextDashboard);
        });
      } catch (refreshError) {
        if (!cancelled) {
          setError(
            refreshError instanceof Error
              ? refreshError.message
              : 'Failed to load graph visualization.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void refresh();

    return () => {
      cancelled = true;
    };
  }, [learnerId, city, location]);

  useEffect(() => {
    if (!dashboard) return;

    setPositions(
      buildGraphLayout(
        viewMode,
        dashboard.selectedPack.nodes,
        dashboard.selectedPack.pack.edges || [],
        GRAPH_WIDTH,
        GRAPH_HEIGHT,
      ),
    );
    setViewport({ x: 0, y: 0, scale: 1 });
    setHoveredNodeId(null);
  }, [dashboard, viewMode]);

  useEffect(() => {
    if (typeof window === 'undefined' || !learnerId) return;

    const params = new URLSearchParams(window.location.search);
    params.set('learnerId', learnerId);
    params.set('city', city);
    params.set('location', location);
    params.set('view', viewMode);
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  }, [learnerId, city, location, viewMode]);

  useEffect(() => {
    const stopDragging = () => {
      dragStateRef.current = null;
    };

    window.addEventListener('pointerup', stopDragging);
    return () => {
      window.removeEventListener('pointerup', stopDragging);
    };
  }, []);

  useEffect(() => {
    if (selectedNodeId) {
      setGraphDetailOpen(true);
    }
  }, [selectedNodeId]);

  useEffect(() => {
    if (selectedMissionGate) {
      setGraphDetailOpen(true);
    }
  }, [selectedMissionGate]);

  useEffect(() => {
    if (!dashboard?.selectedPack.missionGate) {
      setSelectedMissionGate(false);
    }
  }, [dashboard?.selectedPack.missionGate]);

  const learnerOptions = useMemo(() => {
    const deduped = new Map<string, { learnerId: string; displayName: string }>();

    if (runtimeLearnerId) {
      deduped.set(runtimeLearnerId, {
        learnerId: runtimeLearnerId,
        displayName: 'Your runtime learner',
      });
    }

    for (const persona of personas) {
      deduped.set(persona.learnerId, {
        learnerId: persona.learnerId,
        displayName: persona.displayName,
      });
    }

    if (dashboard?.learner?.learnerId && !deduped.has(dashboard.learner.learnerId)) {
      deduped.set(dashboard.learner.learnerId, {
        learnerId: dashboard.learner.learnerId,
        displayName: dashboard.learner.displayName,
      });
    }

    return [...deduped.values()];
  }, [dashboard?.learner, personas, runtimeLearnerId]);

  const validationPresets = useMemo(() => {
    const presets: ValidationPreset[] = [
      {
        key: 'fresh',
        label: 'Fresh blank learner',
        description: 'Generates a brand-new runtime learner with zero evidence.',
        expectation: 'Expect Script tier, lesson next, and hangout not ready.',
        kind: 'fresh',
      },
    ];

    if (runtimeLearnerId) {
      presets.push({
        key: 'runtime',
        label: 'Your runtime learner',
        description: 'Uses the browser-local learner id that `/game`, Learn, and Hangout write into.',
        expectation: 'Best way to inspect your actual local demo progress.',
        learnerId: runtimeLearnerId,
        kind: 'runtime',
      });
    }

    for (const persona of personas) {
      const copy = VALIDATION_PERSONA_COPY[persona.learnerId];
      if (!copy) continue;
      presets.push({
        key: persona.learnerId,
        label: copy.label,
        description: copy.description,
        expectation: copy.expectation,
        learnerId: persona.learnerId,
        kind: 'persona',
      });
    }

    return presets;
  }, [personas, runtimeLearnerId]);

  const allNodes = dashboard?.selectedPack.nodes || [];
  const allEdges = dashboard?.selectedPack.pack.edges || [];
  const searchQuery = search.trim().toLowerCase();

  const visibleNodes = useMemo(() => {
    return allNodes.filter((entry) => {
      if (statusFilter !== 'all' && entry.state.status !== statusFilter) return false;
      if (!searchQuery) return true;

      const haystack = [
        entry.node.title,
        entry.node.nodeId,
        entry.node.description,
        entry.node.objectiveCategory,
        ...(entry.node.tags || []),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(searchQuery);
    });
  }, [allNodes, searchQuery, statusFilter]);

  const visibleNodeIds = useMemo(
    () => new Set(visibleNodes.map((entry) => entry.node.nodeId)),
    [visibleNodes],
  );

  const visibleEdges = useMemo(() => {
    return allEdges.filter(
      (edge) =>
        edgeVisibility[edge.type] &&
        visibleNodeIds.has(edge.fromNodeId) &&
        visibleNodeIds.has(edge.toNodeId),
    );
  }, [allEdges, edgeVisibility, visibleNodeIds]);

  const focusNodeId = hoveredNodeId;

  const focusNodeIds = useMemo(() => {
    const next = new Set<string>();
    if (!focusNodeId) return next;

    next.add(focusNodeId);
    for (const edge of allEdges) {
      if (edge.fromNodeId === focusNodeId) next.add(edge.toNodeId);
      if (edge.toNodeId === focusNodeId) next.add(edge.fromNodeId);
    }
    return next;
  }, [allEdges, focusNodeId]);

  const selectedNode = useMemo(
    () =>
      allNodes.find((entry) => entry.node.nodeId === selectedNodeId) ||
      visibleNodes[0] ||
      null,
    [allNodes, selectedNodeId, visibleNodes],
  );
  const selectedCompletedTargetIds = useMemo(() => {
    if (!selectedNode?.targetProgress) return [];
    const remainingTargetIds = new Set(selectedNode.targetProgress.remainingTargetIds);
    return (selectedNode.node.targetItemIds || []).filter((targetId) => !remainingTargetIds.has(targetId));
  }, [selectedNode]);
  const selectedRemainingTargetIds = useMemo(() => {
    if (!selectedNode) return [];
    return selectedNode.targetProgress?.remainingTargetIds || selectedNode.node.targetItemIds || [];
  }, [selectedNode]);
  const selectedBlockers = useMemo(() => {
    if (!selectedNode) return [];
    return selectedNode.state.blockerNodeIds
      .map((blockerNodeId) => allNodes.find((entry) => entry.node.nodeId === blockerNodeId))
      .filter((entry): entry is GraphSelectedPackNode => Boolean(entry));
  }, [allNodes, selectedNode]);
  const selectedUnlocks = useMemo(() => {
    if (!selectedNode) return [];
    return selectedNode.unlocksNodeIds
      .map((unlockNodeId) => allNodes.find((entry) => entry.node.nodeId === unlockNodeId))
      .filter((entry): entry is GraphSelectedPackNode => Boolean(entry));
  }, [allNodes, selectedNode]);

  const languageSummary = dashboard?.languageSummary || null;
  const missionGate = dashboard?.selectedPack.missionGate || null;
  const lessonBundle = dashboard?.selectedPack.lessonBundle || null;
  const hangoutBundle = dashboard?.selectedPack.hangoutBundle || null;
  const missionTone = missionStatusTone(missionGate);
  const nextUnlocks = dashboard?.nextUnlocks || [];
  const nextUnlockPathNodeIds = useMemo(
    () => new Set(nextUnlocks[0]?.pathNodeIds || []),
    [nextUnlocks],
  );
  const recommendationButtons = dashboard?.recommendations || [];
  const completedCount = countCompleted(allNodes);
  const completedRatio = completionRatio(allNodes);
  const nodeStatusCounts = useMemo(() => {
    const counts: Record<GraphSelectedPackNode['state']['status'], number> = {
      locked: 0,
      available: 0,
      learning: 0,
      due: 0,
      validated: 0,
      mastered: 0,
    };

    for (const entry of allNodes) {
      counts[entry.state.status] += 1;
    }

    return counts;
  }, [allNodes]);
  const authoredCountByLevel = useMemo(() => {
    const counts = new Map<number, number>();

    for (const entry of allNodes) {
      counts.set(entry.node.level, (counts.get(entry.node.level) || 0) + 1);
    }

    return counts;
  }, [allNodes]);
  const missionRequiredEntries = useMemo(() => {
    if (!missionGate) return [];
    return missionGate.requiredNodeIds
      .map((nodeId) => allNodes.find((entry) => entry.node.nodeId === nodeId))
      .filter((entry): entry is GraphSelectedPackNode => Boolean(entry));
  }, [allNodes, missionGate]);
  const missionRequiredTargetIds = useMemo(
    () => [...new Set(missionRequiredEntries.flatMap((entry) => entry.node.targetItemIds || []))],
    [missionRequiredEntries],
  );
  const missionGatePoint = useMemo(() => {
    if (!missionGate) return null;

    const points = missionGate.requiredNodeIds
      .map((nodeId) => positions[nodeId])
      .filter((point): point is Point => Boolean(point));
    const averageX =
      points.length > 0
        ? points.reduce((sum, point) => sum + point.x, 0) / points.length
        : getLevelX(6, GRAPH_WIDTH);
    const averageY =
      points.length > 0
        ? points.reduce((sum, point) => sum + point.y, 0) / points.length
        : GRAPH_HEIGHT / 2;

    const x =
      viewMode === 'curriculum'
        ? GRAPH_WIDTH - 56
        : clamp(
            Math.max(...points.map((point) => point.x), averageX) + 132,
            136,
            GRAPH_WIDTH - 84,
          );
    const y =
      viewMode === 'curriculum' && points.length > 1
        ? clamp(averageY - 18, 96, GRAPH_HEIGHT - 96)
        : clamp(averageY, 96, GRAPH_HEIGHT - 96);

    return {
      x,
      y,
    };
  }, [missionGate, positions, viewMode]);
  const selectedGraphDetailMode =
    selectedMissionGate && missionGate ? 'mission' : selectedNode ? 'node' : null;
  const missionGateCanvasStatus =
    missionGate?.status === 'completed'
      ? 'Complete'
      : missionGate?.status === 'ready'
        ? 'Ready'
        : 'Locked';
  const viewCopy =
    viewMode === 'curriculum'
      ? 'Nodes are pinned to the seven curriculum tiers so authored gaps and progression bands are obvious.'
      : 'Nodes relax into a dependency map so prerequisite chains and dense clusters are easier to inspect.';
  const graphInstruction =
    viewMode === 'curriculum'
      ? 'Drag background to pan. Wheel to zoom. Hover to spotlight. Click nodes or the capstone gate for details.'
      : 'Dependency mode: drag nodes to untangle the pack. Hover to spotlight local edges or inspect the capstone gate.';
  const compactSnapshot = useMemo(() => {
    if (!dashboard) return null;

    return {
      learner: {
        learnerId: dashboard.learner.learnerId,
        displayName: dashboard.learner.displayName,
        proficiency: dashboard.learner.proficiency,
      },
      languageSummary: {
        tier: dashboard.languageSummary.languageTier,
        progressToNextTier: dashboard.languageSummary.progressToNextTier,
        recommendedAction: dashboard.languageSummary.recommendedAction,
      },
      progression: dashboard.progression,
      hangout: {
        ready: Boolean(hangoutBundle?.ready),
        scenarioId: hangoutBundle?.scenarioId || null,
        reason: hangoutBundle?.readiness.reason || null,
      },
      mission: missionGate
        ? {
            status: missionGate.status,
            remainingRequiredNodeIds: missionGate.remainingRequiredNodeIds,
          }
        : null,
      nodeStatusCounts,
      nextUnlocks: nextUnlocks.map((entry) => entry.nodeId),
      activeNodes: allNodes
        .filter((entry) => entry.state.status !== 'locked')
        .slice(0, 10)
        .map((entry) => ({
          nodeId: entry.node.nodeId,
          level: entry.node.level,
          status: entry.state.status,
          masteryScore: entry.state.masteryScore,
          completedTargets: entry.targetProgress?.completedTargetCount || 0,
          totalTargets: entry.targetProgress?.totalTargetCount || 0,
        })),
    };
  }, [allNodes, dashboard, hangoutBundle, missionGate, nextUnlocks, nodeStatusCounts]);

  function applyValidationPreset(preset: ValidationPreset) {
    setCity('seoul');
    setLocation('food_street');
    setViewMode('curriculum');
    setStatusFilter('all');
    setSearch('');
    setViewport({ x: 0, y: 0, scale: 1 });
    setSelectedNodeId(null);
    setSelectedMissionGate(false);
    setGraphDetailOpen(true);
    setSnapshotCopyState('idle');
    setLearnerId(preset.kind === 'fresh' ? buildFreshLearnerId() : preset.learnerId || '');
  }

  async function handleCopySnapshot() {
    if (!compactSnapshot || typeof navigator === 'undefined' || !navigator.clipboard) {
      setSnapshotCopyState('failed');
      return;
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(compactSnapshot, null, 2));
      setSnapshotCopyState('copied');
    } catch {
      setSnapshotCopyState('failed');
    }
  }

  function toGraphPoint(clientX: number, clientY: number) {
    const rect = graphRef.current?.getBoundingClientRect();
    if (!rect) return null;

    const localX = ((clientX - rect.left) * GRAPH_WIDTH) / rect.width;
    const localY = ((clientY - rect.top) * GRAPH_HEIGHT) / rect.height;

    return {
      x: (localX - viewport.x) / viewport.scale,
      y: (localY - viewport.y) / viewport.scale,
    };
  }

  function handleCanvasPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    dragStateRef.current = {
      type: 'pan',
      startX: event.clientX,
      startY: event.clientY,
      origin: viewport,
    };
  }

  function handleCanvasPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState) return;

    if (dragState.type === 'pan') {
      const rect = graphRef.current?.getBoundingClientRect();
      const widthRatio = rect ? GRAPH_WIDTH / rect.width : 1;
      const heightRatio = rect ? GRAPH_HEIGHT / rect.height : 1;

      setViewport({
        ...dragState.origin,
        x: dragState.origin.x + (event.clientX - dragState.startX) * widthRatio,
        y: dragState.origin.y + (event.clientY - dragState.startY) * heightRatio,
      });
      return;
    }

    const point = toGraphPoint(event.clientX, event.clientY);
    if (!point) return;

    setPositions((current) => ({
      ...current,
      [dragState.nodeId]: {
        x: clamp(point.x - dragState.offsetX, 68, GRAPH_WIDTH - 68),
        y: clamp(point.y - dragState.offsetY, 68, GRAPH_HEIGHT - 68),
      },
    }));
  }

  function handleNodePointerDown(
    event: React.PointerEvent<SVGGElement>,
    nodeId: string,
  ) {
    event.stopPropagation();
    const point = toGraphPoint(event.clientX, event.clientY);
    const position = positions[nodeId];
    if (!point || !position) return;

    setSelectedNodeId(nodeId);
    setSelectedMissionGate(false);
    dragStateRef.current = {
      type: 'node',
      nodeId,
      offsetX: point.x - position.x,
      offsetY: point.y - position.y,
    };
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const rect = graphRef.current?.getBoundingClientRect();
    if (!rect) return;

    const localX = ((event.clientX - rect.left) * GRAPH_WIDTH) / rect.width;
    const localY = ((event.clientY - rect.top) * GRAPH_HEIGHT) / rect.height;

    setViewport((current) => {
      const nextScale = clamp(
        current.scale * (event.deltaY < 0 ? 1.1 : 0.92),
        0.55,
        2.5,
      );
      const graphX = (localX - current.x) / current.scale;
      const graphY = (localY - current.y) / current.scale;

      return {
        scale: nextScale,
        x: localX - graphX * nextScale,
        y: localY - graphY * nextScale,
      };
    });
  }

  const orderedVisibleNodes = useMemo(() => {
    return [...visibleNodes].sort((left, right) => {
      const leftFocus = left.node.nodeId === focusNodeId ? 1 : 0;
      const rightFocus = right.node.nodeId === focusNodeId ? 1 : 0;
      return leftFocus - rightFocus;
    });
  }, [focusNodeId, visibleNodes]);

  return (
    <main className="app-shell app-shell--wide">
      <header className="page-header">
        <p className="kicker">Interactive Graph</p>
        <h1 className="page-title">Curriculum knowledge graph</h1>
        <p className="page-copy">
          Pan, zoom, drag nodes, filter by learner state, and inspect how Seoul Food Street
          progression connects through prerequisites, reinforcements, and unlocks.
        </p>
        <div className="nav-links">
          <Link href="/" className="nav-link">
            Home
          </Link>
          <Link href="/dashboard" className="nav-link">
            Dashboard
          </Link>
          <Link href="/overlay" className="nav-link">
            Overlay
          </Link>
          <Link href="/game" className="nav-link">
            Game UI
          </Link>
        </div>
      </header>

      <section className="graph-control-grid card" style={{ marginBottom: 16 }}>
        <label className="stack">
          <span className="pill">Learner</span>
          <select value={learnerId} onChange={(event) => setLearnerId(event.target.value)}>
            {learnerOptions.map((item) => (
              <option key={item.learnerId} value={item.learnerId}>
                {item.displayName}
              </option>
            ))}
          </select>
        </label>

        <label className="stack">
          <span className="pill">City</span>
          <select value={city} onChange={(event) => setCity(event.target.value as CityId)}>
            {CITY_OPTIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="stack">
          <span className="pill">Location</span>
          <select
            value={location}
            onChange={(event) => setLocation(event.target.value as LocationId)}
          >
            {LOCATION_OPTIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="stack">
          <span className="pill">Search</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search node title, tag, or id"
          />
        </label>

        <label className="stack">
          <span className="pill">Status</span>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as 'all' | GraphSelectedPackNode['state']['status'],
              )
            }
          >
            <option value="all">All statuses</option>
            <option value="locked">Locked</option>
            <option value="available">Available</option>
            <option value="learning">Learning</option>
            <option value="due">Due</option>
            <option value="validated">Validated</option>
            <option value="mastered">Mastered</option>
          </select>
        </label>

        <div className="stack">
          <span className="pill">Edge types</span>
          <div className="graph-chip-row">
            {(['requires', 'unlocks', 'reinforces'] as const).map((type) => (
              <button
                key={type}
                type="button"
                className={`graph-chip ${edgeVisibility[type] ? 'graph-chip--active' : ''}`}
                onClick={() =>
                  setEdgeVisibility((current) => ({
                    ...current,
                    [type]: !current[type],
                  }))
                }
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="stack">
          <span className="pill">View</span>
          <div className="graph-chip-row">
            <button
              type="button"
              className={`graph-chip ${viewMode === 'curriculum' ? 'graph-chip--active' : ''}`}
              onClick={() => setViewMode('curriculum')}
            >
              Curriculum
            </button>
            <button
              type="button"
              className={`graph-chip ${viewMode === 'dependency' ? 'graph-chip--active' : ''}`}
              onClick={() => setViewMode('dependency')}
            >
              Dependency
            </button>
            <button
              type="button"
              className="graph-chip"
              onClick={() => setViewport({ x: 0, y: 0, scale: 1 })}
            >
              Reset camera
            </button>
          </div>
        </div>
      </section>

      <section className="graph-route-layout" style={{ marginBottom: 16 }}>
        <article className="card stack">
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ marginBottom: 6 }}>Validation presets</h3>
              <p>
                Use these to validate the progression kernel without editing query params or guessing which
                learner you are looking at.
              </p>
            </div>
            <span className="pill">Seoul Food Street</span>
          </div>

          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            {validationPresets.map((preset) => {
              const active =
                preset.kind === 'fresh'
                  ? learnerId.startsWith('learner_validation_')
                  : learnerId === preset.learnerId;

              return (
                <button
                  key={preset.key}
                  type="button"
                  className={active ? '' : 'secondary'}
                  onClick={() => applyValidationPreset(preset)}
                  style={{
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    alignItems: 'flex-start',
                    minHeight: 142,
                  }}
                >
                  <span className="pill" style={{ background: active ? 'rgba(255,255,255,0.18)' : undefined }}>
                    {preset.label}
                  </span>
                  <strong>{preset.description}</strong>
                  <span style={{ lineHeight: 1.45, opacity: active ? 0.96 : 0.78 }}>
                    {preset.expectation}
                  </span>
                </button>
              );
            })}
          </div>

          <p style={{ fontSize: 13 }}>
            `Your runtime learner` shows browser-local graph state. `Fresh blank learner` always generates a new
            learner id so you can verify true zero-evidence behavior.
          </p>
        </article>

        <article className="card stack">
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ marginBottom: 6 }}>Current snapshot</h3>
              <p>
                Compact state for the learner currently loaded in the graph. This is the fastest check that the
                graph kernel is returning the state you expect.
              </p>
            </div>
            <div className="graph-chip-row">
              <span className="pill">{dashboard?.learner.displayName || 'No learner'}</span>
              <button
                type="button"
                className="secondary"
                onClick={() => void handleCopySnapshot()}
                disabled={!compactSnapshot}
              >
                {snapshotCopyState === 'copied'
                  ? 'Copied'
                  : snapshotCopyState === 'failed'
                    ? 'Copy failed'
                    : 'Copy JSON'}
              </button>
            </div>
          </div>

          <pre
            style={{
              margin: 0,
              padding: 14,
              borderRadius: 16,
              background: '#fff7ef',
              border: '1px solid var(--line)',
              color: '#3f4a5a',
              fontSize: 12,
              lineHeight: 1.55,
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {compactSnapshot ? JSON.stringify(compactSnapshot, null, 2) : 'Loading graph snapshot…'}
          </pre>
        </article>
      </section>

      <section className="graph-metric-grid" style={{ marginBottom: 16 }}>
        {[
          {
            label: 'Tier',
            value: languageSummary ? `L${languageSummary.languageTier.level}` : '—',
            detail: languageSummary
              ? `${languageSummary.languageTier.label} · ${languageSummary.languageTier.description}`
              : 'Loading language tier',
          },
          {
            label: 'Next Tier',
            value: `${Math.round((languageSummary?.progressToNextTier ?? 0) * 100)}%`,
            detail: languageSummary
              ? `${languageSummary.completedNodeCount}/${languageSummary.totalNodeCount} nodes validated`
              : 'Tracking progression to the next tier',
          },
          {
            label: 'Capstone',
            value: missionStatusLabel(missionGate),
            detail: missionGate?.reason || 'No authored mission gate for this pack',
          },
          {
            label: 'Hangout',
            value: hangoutBundle?.ready ? 'Ready' : 'Not ready',
            detail: hangoutBundle?.readiness.reason || 'Loading hangout readiness',
          },
          {
            label: 'Lesson',
            value: lessonBundle?.focusTargetIds.length ?? 0,
            detail: lessonBundle?.reason || 'Loading lesson bundle',
          },
          {
            label: 'Completion',
            value: `${Math.round(completedRatio * 100)}%`,
            detail: `${completedCount}/${allNodes.length || 0} nodes validated`,
          },
        ].map((item) => (
          <article key={item.label} className="card stack">
            <span className="kicker">{item.label}</span>
            <h2 style={{ margin: 0 }}>{item.value}</h2>
            <p>{item.detail}</p>
          </article>
        ))}
      </section>

      {error && (
        <section className="card" style={{ marginBottom: 16 }}>
          <p style={{ color: '#9f1239' }}>{error}</p>
        </section>
      )}

      <section className="graph-route-layout">
        <article className="card stack">
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ marginBottom: 6 }}>Graph view</h3>
              <p>
                {viewCopy} Nodes are sized by mastery, filled by learner state, and outlined by
                objective category.
              </p>
            </div>
            <div className="graph-chip-row">
              <span className="pill">{viewMode === 'curriculum' ? 'Tiered view' : 'Network view'}</span>
              {missionGate?.completed && <span className="pill">Track completed</span>}
              {missionGate?.status === 'ready' && <span className="pill">Capstone ready</span>}
              <span className="pill">{visibleNodes.length} visible nodes</span>
              <span className="pill">{visibleEdges.length} visible edges</span>
            </div>
          </div>

          <div
            ref={graphRef}
            className="graph-canvas-frame"
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={() => {
              dragStateRef.current = null;
            }}
            onPointerLeave={() => {
              dragStateRef.current = null;
              setHoveredNodeId(null);
            }}
            onWheel={handleWheel}
          >
            {loading && <div className="graph-canvas-badge">Loading graph…</div>}
            {!loading && allNodes.length === 0 && (
              <div className="graph-empty-state">
                <strong>No authored node graph yet.</strong>
                <span>That route is still backed by a stub pack.</span>
              </div>
            )}
            {!loading && allNodes.length > 0 && (
              <>
                <div className="graph-canvas-badge">
                  {graphInstruction}
                </div>
                <svg
                  className="graph-canvas"
                  viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
                  role="img"
                  aria-label="Interactive curriculum knowledge graph"
                >
                  <defs>
                    <marker
                      id="graph-arrow-requires"
                      viewBox="0 0 10 10"
                      refX="7"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_TONES.requires.stroke} />
                    </marker>
                    <marker
                      id="graph-arrow-unlocks"
                      viewBox="0 0 10 10"
                      refX="7"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_TONES.unlocks.stroke} />
                    </marker>
                    <marker
                      id="graph-arrow-reinforces"
                      viewBox="0 0 10 10"
                      refX="7"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_TONES.reinforces.stroke} />
                    </marker>
                    <filter id="graph-glow" x="-80%" y="-80%" width="260%" height="260%">
                      <feGaussianBlur stdDeviation="12" result="blur" />
                      <feColorMatrix
                        in="blur"
                        type="matrix"
                        values="1 0 0 0 0
                                0 1 0 0 0
                                0 0 1 0 0
                                0 0 0 0.25 0"
                      />
                    </filter>
                  </defs>

                  <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}>
                    {viewMode === 'curriculum' &&
                      GRAPH_LEVEL_BANDS.map((band, index) => {
                        const x = getLevelX(band.level);
                        const bandWidth =
                          GRAPH_LEVEL_BANDS.length > 1
                            ? (GRAPH_WIDTH - LEVEL_MARGIN_X * 2) / (GRAPH_LEVEL_BANDS.length - 1)
                            : 140;
                        const left = index === 0 ? x - 58 : x - bandWidth / 2 + 8;
                        const width =
                          index === 0 || index === GRAPH_LEVEL_BANDS.length - 1 ? 116 : bandWidth - 16;
                        const authoredCount = authoredCountByLevel.get(band.level) || 0;

                        return (
                          <g key={band.level}>
                            <rect
                              x={left}
                              y={LEVEL_MARGIN_Y - 28}
                              width={width}
                              height={GRAPH_HEIGHT - LEVEL_MARGIN_Y * 2 + 56}
                              rx={26}
                              fill={authoredCount > 0 ? 'rgba(255,255,255,0.028)' : 'rgba(255,255,255,0.012)'}
                              stroke="rgba(255,255,255,0.09)"
                              strokeDasharray="8 10"
                            />
                            <line
                              x1={x}
                              y1={LEVEL_MARGIN_Y - 18}
                              x2={x}
                              y2={GRAPH_HEIGHT - LEVEL_MARGIN_Y + 18}
                              stroke="rgba(255,255,255,0.12)"
                              strokeDasharray="7 10"
                            />
                            <text
                              x={x}
                              y={LEVEL_MARGIN_Y - 40}
                              textAnchor="middle"
                              fill="rgba(255,255,255,0.75)"
                              fontSize="13"
                              fontWeight="700"
                            >
                              Level {band.level}
                            </text>
                            <text
                              x={x}
                              y={LEVEL_MARGIN_Y - 22}
                              textAnchor="middle"
                              fill="rgba(255,255,255,0.46)"
                              fontSize="11"
                              fontWeight="600"
                            >
                              {band.label}
                            </text>
                            <text
                              x={x}
                              y={GRAPH_HEIGHT - LEVEL_MARGIN_Y + 38}
                              textAnchor="middle"
                              fill="rgba(255,255,255,0.42)"
                              fontSize="11"
                              fontWeight="600"
                            >
                              {authoredCount > 0
                                ? `${authoredCount} node${authoredCount === 1 ? '' : 's'}`
                                : 'Unauthored'}
                            </text>
                          </g>
                        );
                      })}

                    {viewMode === 'dependency' && (
                      <>
                        <circle
                          cx={GRAPH_WIDTH / 2}
                          cy={GRAPH_HEIGHT / 2}
                          r={124}
                          fill="rgba(255,255,255,0.02)"
                          stroke="rgba(255,255,255,0.08)"
                          strokeDasharray="8 10"
                        />
                        <circle
                          cx={GRAPH_WIDTH / 2}
                          cy={GRAPH_HEIGHT / 2}
                          r={208}
                          fill="none"
                          stroke="rgba(255,255,255,0.07)"
                          strokeDasharray="8 12"
                        />
                        <circle
                          cx={GRAPH_WIDTH / 2}
                          cy={GRAPH_HEIGHT / 2}
                          r={292}
                          fill="none"
                          stroke="rgba(255,255,255,0.06)"
                          strokeDasharray="8 14"
                        />
                        <text
                          x={GRAPH_WIDTH / 2}
                          y={78}
                          textAnchor="middle"
                          fill="rgba(255,255,255,0.68)"
                          fontSize="13"
                          fontWeight="700"
                        >
                          Dependency layout
                        </text>
                        <text
                          x={GRAPH_WIDTH / 2}
                          y={98}
                          textAnchor="middle"
                          fill="rgba(255,255,255,0.42)"
                          fontSize="11"
                          fontWeight="600"
                        >
                          Connected objectives pull together. Level influence stays soft here.
                        </text>
                      </>
                    )}

                    {visibleEdges.map((edge) => {
                      const source = positions[edge.fromNodeId];
                      const target = positions[edge.toNodeId];
                      if (!source || !target) return null;

                      const isFocused =
                        focusNodeId &&
                        (edge.fromNodeId === focusNodeId || edge.toNodeId === focusNodeId);
                      const opacity = focusNodeId ? (isFocused ? 0.95 : 0.14) : 0.56;

                      return (
                        <path
                          key={edge.edgeId}
                          d={edgePath(source, target, edge.edgeId, edge.type)}
                          fill="none"
                          stroke={EDGE_TONES[edge.type].stroke}
                          strokeWidth={isFocused ? 3.5 : 2}
                          strokeDasharray={EDGE_TONES[edge.type].dash}
                          strokeOpacity={opacity}
                          markerEnd={`url(#graph-arrow-${edge.type})`}
                        >
                          <title>
                            {edge.type}: {edge.fromNodeId} → {edge.toNodeId}
                            {edge.rationale ? ` — ${edge.rationale}` : ''}
                          </title>
                        </path>
                      );
                    })}

                    {orderedVisibleNodes.map((entry) => {
                      const point = positions[entry.node.nodeId];
                      if (!point) return null;

                      const radius = nodeRadius(entry);
                      const statusTone = STATUS_TONES[entry.state.status];
                      const categoryStroke =
                        CATEGORY_TONES[entry.node.objectiveCategory || ''] || '#f8fafc';
                      const isFocused = focusNodeId
                        ? focusNodeIds.has(entry.node.nodeId)
                        : true;
                      const isSelected = selectedNode?.node.nodeId === entry.node.nodeId;
                      const isOnNextUnlockPath = nextUnlockPathNodeIds.has(entry.node.nodeId);
                      const haloStroke = entry.missionCritical
                        ? '#facc15'
                        : isOnNextUnlockPath
                          ? '#7dd3fc'
                          : 'transparent';
                      const labelWidth = shortLabel(entry.node.title).length * 7 + 18;

                      return (
                        <g
                          key={entry.node.nodeId}
                          transform={`translate(${point.x} ${point.y})`}
                          onPointerEnter={(event) => {
                            event.stopPropagation();
                            setHoveredNodeId(entry.node.nodeId);
                          }}
                          onPointerLeave={(event) => {
                            event.stopPropagation();
                            setHoveredNodeId((current) =>
                              current === entry.node.nodeId ? null : current,
                            );
                          }}
                          onPointerDown={(event) =>
                            handleNodePointerDown(event, entry.node.nodeId)
                          }
                          style={{ opacity: isFocused ? 1 : 0.2, cursor: 'grab' }}
                        >
                          <circle
                            r={radius + 16}
                            fill="none"
                            stroke={haloStroke}
                            strokeWidth={haloStroke === 'transparent' ? 0 : isSelected ? 3 : 2}
                            strokeDasharray={entry.missionCritical ? '7 6' : '12 8'}
                            opacity={isFocused ? 0.95 : 0.24}
                          />
                          <circle
                            r={radius + 11}
                            fill={categoryStroke}
                            opacity={isSelected ? 0.18 : 0.09}
                            filter="url(#graph-glow)"
                          />
                          <circle
                            r={radius + 4}
                            fill="rgba(7,12,24,0.55)"
                            stroke={categoryStroke}
                            strokeWidth={isSelected ? 4 : 2}
                          />
                          <circle
                            r={radius}
                            fill={statusTone.fill}
                            stroke={statusTone.stroke}
                            strokeWidth={2.5}
                          />
                          <text
                            x={0}
                            y={3}
                            textAnchor="middle"
                            fill={statusTone.ink}
                            fontSize={12}
                            fontWeight={700}
                          >
                            {Math.round(entry.state.masteryScore * 100)}
                          </text>
                          <rect
                            x={-labelWidth / 2}
                            y={radius + 11}
                            width={labelWidth}
                            height={22}
                            rx={11}
                            fill="rgba(9, 14, 28, 0.82)"
                            stroke="rgba(255,255,255,0.12)"
                          />
                          <text
                            x={0}
                            y={radius + 26}
                            textAnchor="middle"
                            fill="#f8fafc"
                            fontSize={12}
                            fontWeight={600}
                          >
                            {shortLabel(entry.node.title)}
                          </text>
                          <title>
                            {entry.node.title}
                            {'\n'}
                            Status: {entry.state.status}
                            {'\n'}
                            Mastery: {Math.round(entry.state.masteryScore * 100)}%
                            {'\n'}
                            Evidence: {entry.state.evidenceCount}
                            {entry.targetProgress
                              ? `\nTarget progress: ${entry.targetProgress.completedTargetCount}/${entry.targetProgress.totalTargetCount}`
                              : ''}
                            {entry.targetProgress
                              ? `\nRemaining gaps: ${entry.targetProgress.remainingTargetIds.length}`
                              : ''}
                          </title>
                        </g>
                      );
                    })}

                    {missionGate &&
                      missionGatePoint &&
                      missionRequiredEntries.map((entry) => {
                        const source = positions[entry.node.nodeId];
                        if (!source) return null;

                        return (
                          <path
                            key={`mission-link-${entry.node.nodeId}`}
                            d={edgePath(source, missionGatePoint, `mission_${entry.node.nodeId}`, 'unlocks')}
                            fill="none"
                            stroke={missionTone.edge}
                            strokeWidth={selectedMissionGate ? 3.5 : 2.5}
                            strokeDasharray="8 7"
                            strokeOpacity={0.9}
                          />
                        );
                      })}

                    {missionGate && missionGatePoint && (
                      <g
                        transform={`translate(${missionGatePoint.x} ${missionGatePoint.y})`}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          setSelectedMissionGate(true);
                          setGraphDetailOpen(true);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <text
                          x={0}
                          y={-56}
                          textAnchor="middle"
                          fill={missionTone.halo}
                          fontSize={12}
                          fontWeight={700}
                        >
                          Capstone
                        </text>
                        <text
                          x={0}
                          y={-40}
                          textAnchor="middle"
                          fill={missionTone.halo}
                          fontSize={10}
                          fontWeight={700}
                        >
                          {missionGateCanvasStatus}
                        </text>
                        <circle
                          r={selectedMissionGate ? 38 : 34}
                          fill="none"
                          stroke={missionTone.halo}
                          strokeWidth={selectedMissionGate ? 4 : 3}
                          strokeDasharray="10 8"
                          opacity={0.9}
                        />
                        <polygon
                          points="0,-28 28,0 0,28 -28,0"
                          fill="rgba(9, 14, 28, 0.82)"
                          stroke={missionTone.stroke}
                          strokeWidth={selectedMissionGate ? 4 : 3}
                        />
                        <polygon
                          points="0,-20 20,0 0,20 -20,0"
                          fill={missionTone.fill}
                          stroke={missionTone.stroke}
                          strokeWidth={2}
                        />
                        <text
                          x={0}
                          y={4}
                          textAnchor="middle"
                          fill={missionTone.ink}
                          fontSize={12}
                          fontWeight={800}
                        >
                          CAP
                        </text>
                        <title>
                          {missionGate.title}
                          {'\n'}
                          Status: {missionStatusLabel(missionGate)}
                          {'\n'}
                          Ready requirements: {missionGate.completedRequiredNodeIds.length}/{missionGate.requiredNodeIds.length}
                          {missionGate.completedAt ? `\nCompleted: ${readableDate(missionGate.completedAt)}` : ''}
                        </title>
                      </g>
                    )}
                  </g>
                </svg>
                {selectedGraphDetailMode === 'mission' && missionGate && graphDetailOpen && (
                  <div
                    className="graph-focus-card"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                    }}
                    onWheel={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    <div className="graph-focus-header">
                      <div className="stack" style={{ gap: 10 }}>
                        <div className="graph-focus-title-wrap">
                          <span className="graph-focus-kicker">Capstone mission</span>
                          <div className="graph-chip-row">
                            <span className="graph-focus-pill">{missionStatusLabel(missionGate)}</span>
                            <span className="graph-focus-pill">Level {missionGate.level}</span>
                            <span className="graph-focus-pill">Final track gate</span>
                          </div>
                        </div>
                        <div className="stack" style={{ gap: 6 }}>
                          <h4 style={{ margin: 0 }}>{missionGate.title}</h4>
                          <p style={{ margin: 0 }}>{missionGate.description}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="graph-focus-close"
                        onClick={() => setGraphDetailOpen(false)}
                        aria-label="Close capstone mission details"
                      >
                        Close
                      </button>
                    </div>

                    <div className="graph-focus-metrics">
                      <div className="graph-focus-metric">
                        <span className="graph-focus-label">Status</span>
                        <strong>{missionStatusLabel(missionGate)}</strong>
                      </div>
                      <div className="graph-focus-metric">
                        <span className="graph-focus-label">Readiness</span>
                        <strong>
                          {missionGate.completedRequiredNodeIds.length}/{missionGate.requiredNodeIds.length}
                        </strong>
                      </div>
                      <div className="graph-focus-metric">
                        <span className="graph-focus-label">Rewards</span>
                        <strong>+{missionGate.rewards.xp} XP</strong>
                      </div>
                    </div>

                    <div className="graph-focus-section">
                      <span className="graph-focus-label">Capstone state</span>
                      <p>{missionGate.reason}</p>
                      {missionGate.completedAt && (
                        <p>Completed {readableDate(missionGate.completedAt)}.</p>
                      )}
                    </div>

                    <div className="graph-focus-section">
                      <span className="graph-focus-label">Mastery objectives required</span>
                      <div className="graph-chip-row">
                        {missionRequiredEntries.map((entry) => (
                          <button
                            key={entry.node.nodeId}
                            type="button"
                            className="graph-focus-chip-button"
                            onClick={() => {
                              setSelectedMissionGate(false);
                              setSelectedNodeId(entry.node.nodeId);
                            }}
                          >
                            {shortLabel(entry.node.title)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="graph-focus-section">
                      <span className="graph-focus-label">What this demonstrates</span>
                      <div className="graph-chip-row">
                        {missionRequiredTargetIds.length > 0 ? (
                          missionRequiredTargetIds.map((targetId) => (
                            <span key={targetId} className="graph-focus-chip graph-focus-chip--learned">
                              {targetId}
                            </span>
                          ))
                        ) : (
                          <span className="graph-focus-empty">No explicit capstone targets authored yet.</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {selectedGraphDetailMode === 'node' && selectedNode && graphDetailOpen && (
                  <div
                    className="graph-focus-card"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                    }}
                    onWheel={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    <div className="graph-focus-header">
                      <div className="stack" style={{ gap: 10 }}>
                        <div className="graph-focus-title-wrap">
                          <span className="graph-focus-kicker">Node details</span>
                          <div className="graph-chip-row">
                            <span className="graph-focus-pill">{selectedNode.state.status}</span>
                            <span className="graph-focus-pill">
                              Level {selectedNode.node.level} · {selectedNode.node.objectiveCategory || 'objective'}
                            </span>
                            {selectedNode.missionCritical && (
                              <span className="graph-focus-pill">Mission critical</span>
                            )}
                            {nextUnlockPathNodeIds.has(selectedNode.node.nodeId) && (
                              <span className="graph-focus-pill">Next unlock path</span>
                            )}
                          </div>
                        </div>
                        <div className="stack" style={{ gap: 6 }}>
                          <h4 style={{ margin: 0 }}>{selectedNode.node.title}</h4>
                          <p style={{ margin: 0 }}>
                            {selectedNode.node.description || 'No authored description yet.'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="graph-focus-close"
                        onClick={() => setGraphDetailOpen(false)}
                        aria-label="Close selected node details"
                      >
                        Close
                      </button>
                    </div>

                    <div className="graph-focus-metrics">
                      <div className="graph-focus-metric">
                        <span className="graph-focus-label">Mastery</span>
                        <strong>{Math.round(selectedNode.state.masteryScore * 100)}%</strong>
                      </div>
                      <div className="graph-focus-metric">
                        <span className="graph-focus-label">Evidence</span>
                        <strong>{selectedNode.state.evidenceCount}</strong>
                      </div>
                      <div className="graph-focus-metric">
                        <span className="graph-focus-label">Target progress</span>
                        <strong>
                          {selectedNode.targetProgress
                            ? `${selectedNode.targetProgress.completedTargetCount}/${selectedNode.targetProgress.totalTargetCount}`
                            : `${selectedCompletedTargetIds.length}/${selectedNode.node.targetItemIds.length}`}
                        </strong>
                      </div>
                    </div>

                    {selectedNode.state.recommendedReason && (
                      <div className="graph-focus-section">
                        <span className="graph-focus-label">Why this matters now</span>
                        <p>{selectedNode.state.recommendedReason}</p>
                      </div>
                    )}

                    {selectedNode.node.tags.length > 0 && (
                      <div className="graph-focus-section">
                        <span className="graph-focus-label">What it is about</span>
                        <div className="graph-chip-row">
                          {selectedNode.node.tags.map((tag) => (
                            <span key={tag} className="graph-focus-pill">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="graph-focus-section">
                      <span className="graph-focus-label">What you have learned</span>
                      <div className="graph-chip-row">
                        {selectedCompletedTargetIds.length > 0 ? (
                          selectedCompletedTargetIds.map((targetId) => (
                            <span key={targetId} className="graph-focus-chip graph-focus-chip--learned">
                              {targetId}
                            </span>
                          ))
                        ) : (
                          <span className="graph-focus-empty">No demonstrated item-level mastery yet.</span>
                        )}
                      </div>
                    </div>

                    <div className="graph-focus-section">
                      <span className="graph-focus-label">Remaining gaps</span>
                      <div className="graph-chip-row">
                        {selectedRemainingTargetIds.length > 0 ? (
                          selectedRemainingTargetIds.map((targetId) => (
                            <span key={targetId} className="graph-focus-chip graph-focus-chip--gap">
                              {targetId}
                            </span>
                          ))
                        ) : (
                          <span className="graph-focus-empty">No remaining gaps on this node.</span>
                        )}
                      </div>
                    </div>

                    <div className="graph-focus-section">
                      <span className="graph-focus-label">Blockers</span>
                      <div className="graph-chip-row">
                        {selectedBlockers.length > 0 ? (
                          selectedBlockers.map((entry) => (
                            <button
                              key={entry.node.nodeId}
                              type="button"
                              className="graph-focus-chip-button"
                              onClick={() => {
                                setSelectedMissionGate(false);
                                setSelectedNodeId(entry.node.nodeId);
                              }}
                            >
                              {shortLabel(entry.node.title)}
                            </button>
                          ))
                        ) : (
                          <span className="graph-focus-empty">No active blockers.</span>
                        )}
                      </div>
                    </div>

                    <div className="graph-focus-section">
                      <span className="graph-focus-label">Unlocks next</span>
                      <div className="graph-chip-row">
                        {selectedUnlocks.length > 0 ? (
                          selectedUnlocks.map((entry) => (
                            <button
                              key={entry.node.nodeId}
                              type="button"
                              className="graph-focus-chip-button"
                              onClick={() => {
                                setSelectedMissionGate(false);
                                setSelectedNodeId(entry.node.nodeId);
                              }}
                            >
                              {shortLabel(entry.node.title)}
                            </button>
                          ))
                        ) : (
                          <span className="graph-focus-empty">No direct authored unlocks.</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </article>

        <aside className="graph-sidebar stack">
          <article className="card stack">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ marginBottom: 6 }}>Learner snapshot</h3>
                <p>
                  {dashboard?.learner.displayName || 'Loading learner'} ·{' '}
                  {dashboard?.selectedPack.pack.title || 'Loading pack'}
                </p>
              </div>
              {dashboard?.learner && (
                <span className="pill">{dashboard.learner.learnerId}</span>
              )}
            </div>
            <div className="graph-chip-row">
              {dashboard?.learner.targetLanguages.map((lang) => (
                <span key={lang} className="pill">
                  {lang.toUpperCase()}
                </span>
              ))}
              {missionGate?.completed && <span className="pill">Track completed</span>}
              <span className="pill">
                {dashboard?.evidence.totalEvents ?? 0} evidence events
              </span>
              <span className="pill">
                Updated {readableDate(dashboard?.evidence.lastUpdatedAt)}
              </span>
            </div>
            {languageSummary && (
              <>
                <div className="stack" style={{ gap: 8 }}>
                  <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                    <strong>
                      Level {languageSummary.languageTier.level} · {languageSummary.languageTier.label}
                    </strong>
                    <span className="pill">{languageSummary.recommendedAction}</span>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: 10,
                      borderRadius: 999,
                      background: 'rgba(148, 163, 184, 0.18)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.round(languageSummary.progressToNextTier * 100)}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #f97316 0%, #22c55e 100%)',
                      }}
                    />
                  </div>
                  <p>
                    {Math.round(languageSummary.progressToNextTier * 100)}% to the next tier. Strongest:{' '}
                    {languageSummary.strongestCategories.map((item) => item.category).join(', ') || 'n/a'}.
                    Weakest: {languageSummary.weakestCategories.map((item) => item.category).join(', ') || 'n/a'}.
                  </p>
                </div>
              </>
            )}
          </article>

          <article className="card stack">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ marginBottom: 6 }}>Next Unlock Path</h3>
                <p>These are the nearest locked objectives and the blockers standing in front of them.</p>
              </div>
              <span className="pill">{nextUnlocks.length}</span>
            </div>
            <div className="graph-mini-list">
              {nextUnlocks.length > 0 ? (
                nextUnlocks.map((item) => (
                  <button
                    key={item.nodeId}
                    type="button"
                    className="graph-list-button"
                    onClick={() => {
                      setSelectedMissionGate(false);
                      setSelectedNodeId(item.nodeId);
                    }}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.reason}</span>
                  </button>
                ))
              ) : (
                <p>No locked objectives remain in this authored pack.</p>
              )}
            </div>
          </article>

          <article className="card stack">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ marginBottom: 6 }}>Capstone Gate</h3>
                <p>Final mastery check for this location track.</p>
              </div>
              <span className="pill">{missionStatusLabel(missionGate)}</span>
            </div>
            {missionGate ? (
              <>
                <div className="stack">
                  <strong>{missionGate.title}</strong>
                  <p>{missionGate.reason}</p>
                  <button
                    type="button"
                    className="graph-list-button"
                    onClick={() => {
                      setSelectedMissionGate(true);
                      setGraphDetailOpen(true);
                    }}
                  >
                    <strong>Inspect capstone mission</strong>
                    <span>Open the in-graph capstone details panel.</span>
                  </button>
                </div>
                <div className="graph-detail-grid">
                  <div className="graph-detail-card">
                    <span className="kicker">Rewards</span>
                    <strong>
                      +{missionGate.rewards.xp} XP · +{missionGate.rewards.sp} SP
                    </strong>
                  </div>
                  <div className="graph-detail-card">
                    <span className="kicker">Required</span>
                    <strong>{missionGate.requiredNodeIds.length}</strong>
                  </div>
                  <div className="graph-detail-card">
                    <span className="kicker">Done</span>
                    <strong>{missionGate.completedRequiredNodeIds.length}</strong>
                  </div>
                  <div className="graph-detail-card">
                    <span className="kicker">Remaining</span>
                    <strong>{missionGate.remainingRequiredNodeIds.length}</strong>
                  </div>
                </div>
                {missionGate.completedAt && (
                  <div className="graph-detail-card">
                    <span className="kicker">Completed</span>
                    <strong>{readableDate(missionGate.completedAt)}</strong>
                  </div>
                )}
                {missionGate.remainingRequiredNodeIds.length > 0 && (
                  <div className="graph-chip-row">
                    {missionGate.remainingRequiredNodeIds.map((nodeId) => (
                      <button
                        key={nodeId}
                        type="button"
                        className="graph-list-button"
                        onClick={() => {
                          setSelectedMissionGate(false);
                          setSelectedNodeId(nodeId);
                        }}
                      >
                        <strong>
                          {allNodes.find((entry) => entry.node.nodeId === nodeId)?.node.title || nodeId}
                        </strong>
                        <span>Remaining requirement</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p>No authored mission exists for this pack yet.</p>
            )}
          </article>

          <article className="card stack">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ marginBottom: 6 }}>Selected node</h3>
                <p>Click any node in the graph to inspect its state and blockers.</p>
              </div>
              {selectedNode && <span className="pill">{selectedNode.state.status}</span>}
            </div>

            {selectedNode ? (
              <>
                <div className="stack">
                  <strong>{selectedNode.node.title}</strong>
                  <p>{selectedNode.node.description}</p>
                  <div className="graph-chip-row">
                    {selectedNode.missionCritical && <span className="pill">Mission critical</span>}
                    {nextUnlockPathNodeIds.has(selectedNode.node.nodeId) && (
                      <span className="pill">Next unlock path</span>
                    )}
                    <span className="pill">{selectedNode.state.status}</span>
                  </div>
                </div>

                <div className="graph-detail-grid">
                  <div className="graph-detail-card">
                    <span className="kicker">Mastery</span>
                    <strong>{Math.round(selectedNode.state.masteryScore * 100)}%</strong>
                  </div>
                  <div className="graph-detail-card">
                    <span className="kicker">Evidence</span>
                    <strong>{selectedNode.state.evidenceCount}</strong>
                  </div>
                  <div className="graph-detail-card">
                    <span className="kicker">Level</span>
                    <strong>{selectedNode.node.level}</strong>
                  </div>
                  <div className="graph-detail-card">
                    <span className="kicker">Category</span>
                    <strong>{selectedNode.node.objectiveCategory || 'objective'}</strong>
                  </div>
                  <div className="graph-detail-card">
                    <span className="kicker">Target Progress</span>
                    <strong>
                      {selectedNode.targetProgress
                        ? `${selectedNode.targetProgress.completedTargetCount}/${selectedNode.targetProgress.totalTargetCount}`
                        : 'n/a'}
                    </strong>
                  </div>
                  <div className="graph-detail-card">
                    <span className="kicker">Unlocks</span>
                    <strong>{selectedNode.unlocksNodeIds.length}</strong>
                  </div>
                </div>

                {selectedNode.state.recommendedReason && (
                  <div className="stack">
                    <span className="pill">Reason</span>
                    <p>{selectedNode.state.recommendedReason}</p>
                  </div>
                )}

                <div className="stack">
                  <span className="pill">Tags</span>
                  <div className="graph-chip-row">
                    {selectedNode.node.tags.map((tag) => (
                      <span key={tag} className="pill">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="stack">
                  <span className="pill">Remaining Targets</span>
                  <p>
                    {selectedNode.targetProgress
                      ? selectedNode.targetProgress.remainingTargetIds.join(', ') ||
                        'All current targets are covered.'
                      : selectedNode.node.targetItemIds.join(', ') || 'No explicit targets'}
                  </p>
                </div>

                {selectedNode.targetProgress && (
                  <div className="stack">
                    <span className="pill">Target Progress</span>
                    <p>
                      Completed {selectedNode.targetProgress.completedTargetCount} of{' '}
                      {selectedNode.targetProgress.totalTargetCount}. Weak items:{' '}
                      {selectedNode.targetProgress.weakTargetIds.join(', ') || 'none'}.
                    </p>
                    <p>
                      Last practiced:{' '}
                      {selectedNode.targetProgress.lastPracticedTargetIds.join(', ') || 'none yet'}.
                    </p>
                  </div>
                )}

                {selectedNode.targetProgress && (
                  <div className="stack">
                    <span className="pill">Demonstrated Mastery</span>
                    <div className="graph-chip-row">
                      {selectedCompletedTargetIds.length > 0 ? (
                        selectedCompletedTargetIds.map((targetId) => (
                          <span key={targetId} className="pill">
                            {targetId}
                          </span>
                        ))
                      ) : (
                        <span className="pill">No demonstrated targets yet</span>
                      )}
                    </div>
                  </div>
                )}

                {selectedNode.targetProgress && (
                  <div className="stack">
                    <span className="pill">Remaining Gaps</span>
                    <div className="graph-chip-row">
                      {selectedNode.targetProgress.remainingTargetIds.length > 0 ? (
                        selectedNode.targetProgress.remainingTargetIds.map((targetId) => (
                          <span
                            key={targetId}
                            className="pill"
                            style={{
                              background: '#ebe7df',
                              borderColor: '#d4c8b9',
                              color: '#6b6257',
                            }}
                          >
                            {targetId}
                          </span>
                        ))
                      ) : (
                        <span className="pill">No remaining gaps</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="stack">
                  <span className="pill">Blockers</span>
                  {selectedNode.state.blockerNodeIds.length > 0 ? (
                    <div className="graph-chip-row">
                      {selectedNode.state.blockerNodeIds.map((blockerNodeId) => (
                        <button
                          key={blockerNodeId}
                          type="button"
                          className="graph-list-button"
                          onClick={() => {
                            setSelectedMissionGate(false);
                            setSelectedNodeId(blockerNodeId);
                          }}
                        >
                          <strong>
                            {shortLabel(
                              allNodes.find((entry) => entry.node.nodeId === blockerNodeId)?.node
                                .title || blockerNodeId,
                            )}
                          </strong>
                          <span>Jump to prerequisite</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p>No active blockers.</p>
                  )}
                </div>

                <div className="stack">
                  <span className="pill">Unlocks</span>
                  {selectedNode.unlocksNodeIds.length > 0 ? (
                    <div className="graph-chip-row">
                      {selectedNode.unlocksNodeIds.map((unlockNodeId) => (
                        <button
                          key={unlockNodeId}
                          type="button"
                          className="graph-list-button"
                          onClick={() => {
                            setSelectedMissionGate(false);
                            setSelectedNodeId(unlockNodeId);
                          }}
                        >
                          <strong>
                            {allNodes.find((entry) => entry.node.nodeId === unlockNodeId)?.node.title ||
                              unlockNodeId}
                          </strong>
                          <span>Directly unlocked by this node</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p>No direct unlocks in this authored pack.</p>
                  )}
                </div>
              </>
            ) : (
              <p>No node selected.</p>
            )}
          </article>

          <article className="card stack">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ marginBottom: 6 }}>Recommendations</h3>
                <p>Jump straight to the nodes the runtime thinks matter most next.</p>
              </div>
              <span className="pill">{recommendationButtons.length}</span>
            </div>
            <div className="graph-mini-list">
              {recommendationButtons.map((item) => (
                <button
                  key={item.recommendationId}
                  type="button"
                  className="graph-list-button"
                  onClick={() => {
                    if (item.type === 'mission' && missionGate) {
                      setSelectedMissionGate(true);
                      setGraphDetailOpen(true);
                      return;
                    }
                    const nextNodeId = item.nodeIds.find((nodeId) =>
                      allNodes.some((entry) => entry.node.nodeId === nodeId),
                    );
                    if (nextNodeId) {
                      setSelectedMissionGate(false);
                      setSelectedNodeId(nextNodeId);
                    }
                  }}
                >
                  <strong>{item.title}</strong>
                  <span>{item.reason}</span>
                </button>
              ))}
            </div>
          </article>

          <article className="card stack">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ marginBottom: 6 }}>Legend</h3>
                <p>Status controls fill color. Category controls ring color. Blue halos mark the next unlock path. Gold halos mark mission-critical nodes.</p>
              </div>
            </div>

            <div className="graph-mini-list">
              {Object.entries(STATUS_TONES).map(([status, tone]) => (
                <div key={status} className="graph-legend-row">
                  <span
                    className="graph-legend-swatch"
                    style={{ background: tone.fill, borderColor: tone.stroke }}
                  />
                  <span>{status}</span>
                </div>
              ))}
            </div>

            <div className="graph-mini-list">
              {Object.entries(CATEGORY_TONES).map(([category, tone]) => (
                <div key={category} className="graph-legend-row">
                  <span
                    className="graph-legend-swatch graph-legend-swatch--ring"
                    style={{ borderColor: tone }}
                  />
                  <span>{category}</span>
                </div>
              ))}
            </div>

            <div className="graph-mini-list">
              {(Object.entries(EDGE_TONES) as Array<[GraphPackEdge['type'], { stroke: string; dash?: string }]>).map(
                ([type, tone]) => (
                  <div key={type} className="graph-legend-row">
                    <span className="graph-legend-line">
                      <svg width="54" height="12" viewBox="0 0 54 12" aria-hidden="true">
                        <line
                          x1="2"
                          y1="6"
                          x2="52"
                          y2="6"
                          stroke={tone.stroke}
                          strokeWidth="3"
                          strokeDasharray={tone.dash}
                        />
                      </svg>
                    </span>
                    <span>{type}</span>
                  </div>
                ),
              )}
            </div>
          </article>
        </aside>
      </section>
    </main>
  );
}
