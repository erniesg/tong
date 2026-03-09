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
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, Point>>({});
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const [edgeVisibility, setEdgeVisibility] = useState<Record<GraphPackEdge['type'], boolean>>({
    requires: true,
    unlocks: true,
    reinforces: true,
  });
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

  const recommendationButtons = dashboard?.recommendations || [];
  const completedCount = countCompleted(allNodes);
  const completedRatio = completionRatio(allNodes);
  const authoredCountByLevel = useMemo(() => {
    const counts = new Map<number, number>();

    for (const entry of allNodes) {
      counts.set(entry.node.level, (counts.get(entry.node.level) || 0) + 1);
    }

    return counts;
  }, [allNodes]);
  const viewCopy =
    viewMode === 'curriculum'
      ? 'Nodes are pinned to the seven curriculum tiers so authored gaps and progression bands are obvious.'
      : 'Nodes relax into a dependency map so prerequisite chains and dense clusters are easier to inspect.';
  const graphInstruction =
    viewMode === 'curriculum'
      ? 'Drag background to pan. Wheel to zoom. Hover to spotlight. Click for details.'
      : 'Dependency mode: drag nodes to untangle the pack. Hover to spotlight local edges.';

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

      <section className="graph-metric-grid" style={{ marginBottom: 16 }}>
        {[
          { label: 'XP', value: dashboard?.progression.xp ?? 0, detail: 'Graph-derived mastery' },
          { label: 'SP', value: dashboard?.progression.sp ?? 0, detail: 'Unlock currency' },
          { label: 'RP', value: dashboard?.progression.rp ?? 0, detail: 'Relationship progress' },
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
                          </title>
                        </g>
                      );
                    })}
                  </g>
                </svg>
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
              <span className="pill">
                {dashboard?.evidence.totalEvents ?? 0} evidence events
              </span>
              <span className="pill">
                Updated {readableDate(dashboard?.evidence.lastUpdatedAt)}
              </span>
            </div>
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
                  <span className="pill">Targets</span>
                  <p>{selectedNode.node.targetItemIds.join(', ') || 'No explicit targets'}</p>
                </div>

                <div className="stack">
                  <span className="pill">Blockers</span>
                  {selectedNode.state.blockerNodeIds.length > 0 ? (
                    <div className="graph-chip-row">
                      {selectedNode.state.blockerNodeIds.map((blockerNodeId) => (
                        <button
                          key={blockerNodeId}
                          type="button"
                          className="graph-list-button"
                          onClick={() => setSelectedNodeId(blockerNodeId)}
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
                    const nextNodeId = item.nodeIds.find((nodeId) =>
                      allNodes.some((entry) => entry.node.nodeId === nodeId),
                    );
                    if (nextNodeId) setSelectedNodeId(nextNodeId);
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
                <p>Status controls fill color. Category controls ring color. Edge color maps relation.</p>
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
