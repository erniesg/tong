'use client';

import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import {
  fetchGraphDashboard,
  fetchGraphPersonas,
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
  vocabulary: '#18a276',
  grammar: '#7c65ff',
  sentences: '#4f72df',
  conversation: '#0f766e',
  mastery: '#111827',
};

const EDGE_TONES: Record<GraphPackEdge['type'], { stroke: string; dash?: string }> = {
  requires: { stroke: '#ff8b62' },
  unlocks: { stroke: '#24b287' },
  reinforces: { stroke: '#7c65ff', dash: '9 7' },
};

type GraphViewMode = 'curriculum' | 'dependency';

type Point = {
  x: number;
  y: number;
};

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

function percent(value: number) {
  const normalized = value > 1 ? value / 100 : value;
  return Math.max(0, Math.min(100, Math.round(normalized * 100)));
}

function formatDateTime(value?: string) {
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
  if (trimmed.length <= 24) return trimmed;
  return `${trimmed.slice(0, 22)}…`;
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

function buildInitialSelection(dashboard: GraphDashboardResponse | null) {
  if (!dashboard?.selectedPack?.nodes?.length) return null;

  const nextActionNodeId = dashboard.nextActions
    .flatMap((action) => action.recommendedNodeIds)
    .find((nodeId) => dashboard.selectedPack?.nodes.some((entry) => entry.node.nodeId === nodeId));

  if (nextActionNodeId) return nextActionNodeId;

  const lessonNodeId = dashboard.lessonBundle.targets[0]?.nodeId;
  if (lessonNodeId) return lessonNodeId;

  return dashboard.selectedPack.nodes[0]?.node.nodeId || null;
}

function getLevelX(level: number, width = GRAPH_WIDTH) {
  const innerWidth = width - LEVEL_MARGIN_X * 2;
  const step = GRAPH_LEVEL_BANDS.length > 1 ? innerWidth / (GRAPH_LEVEL_BANDS.length - 1) : 0;
  return LEVEL_MARGIN_X + level * step;
}

function buildCurriculumLayout(
  nodes: GraphSelectedPackNode[],
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
      const jitterX = ((seed % 34) - 17) * 0.9;
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

    const radius = 132 + level * 76;
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
    const forces = new Map<string, Point>(nodes.map((entry) => [entry.node.nodeId, { x: 0, y: 0 }]));

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
      const targetLength = edge.type === 'reinforces' ? 172 : edge.type === 'unlocks' ? 138 : 124;
      const strength = edge.type === 'reinforces' ? 0.009 : edge.type === 'unlocks' ? 0.017 : 0.013;
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
    : buildCurriculumLayout(nodes, width, height);
}

function edgePath(source: Point, target: Point, edgeId: string, type: GraphPackEdge['type']) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.max(Math.hypot(dx, dy), 1);
  const midpointX = (source.x + target.x) / 2;
  const midpointY = (source.y + target.y) / 2;
  const direction = hashSeed(edgeId) % 2 === 0 ? 1 : -1;
  const curvature = type === 'reinforces' ? 34 : type === 'unlocks' ? 22 : 14;
  const controlX = midpointX + (-dy / distance) * curvature * direction;
  const controlY = midpointY + (dx / distance) * curvature * direction;
  return `M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`;
}

function nodeRadius(entry: GraphSelectedPackNode) {
  return 10 + entry.state.masteryScore * 16 + Math.min(entry.state.evidenceCount, 7);
}

function StatusPill({ status }: { status: string }) {
  return <span className="pill">{statusLabel(status)}</span>;
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="graph-progress-rail" aria-hidden="true">
      <div className="graph-progress-fill" style={{ width: `${percent(value)}%` }} />
    </div>
  );
}

export default function GraphPage() {
  const [personas, setPersonas] = useState<GraphPersonaSummary[]>([]);
  const [personaId, setPersonaId] = useState('');
  const [city, setCity] = useState<CityId>('seoul');
  const [location, setLocation] = useState<LocationId>('food_street');
  const [dashboard, setDashboard] = useState<GraphDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | GraphSelectedPackNode['state']['status']>('all');
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

        const params = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
        const requestedPersonaId = params.get('personaId') || '';
        const requestedCity = params.get('city');
        const requestedLocation = params.get('location');
        const requestedView = params.get('view');
        const payload = await fetchGraphPersonas();

        if (cancelled) return;

        setPersonas(payload.items);
        setPersonaId(payload.items.find((item) => item.personaId === requestedPersonaId)?.personaId || payload.items[0]?.personaId || '');

        if (requestedCity === 'seoul' || requestedCity === 'tokyo' || requestedCity === 'shanghai') {
          setCity(requestedCity);
        }

        if (typeof requestedLocation === 'string' && requestedLocation.trim()) {
          setLocation(requestedLocation as LocationId);
        }

        if (requestedView === 'curriculum' || requestedView === 'dependency') {
          setViewMode(requestedView);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load the progression atlas.');
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
    if (!personaId) return;

    let cancelled = false;

    async function refresh() {
      try {
        setLoading(true);
        setError(null);

        const nextDashboard = await fetchGraphDashboard({
          personaId,
          city,
          location,
        });

        if (cancelled) return;

        setDashboard(nextDashboard);
        setSelectedNodeId((current) => {
          if (
            current &&
            nextDashboard.selectedPack?.nodes.some((entry) => entry.node.nodeId === current)
          ) {
            return current;
          }
          return buildInitialSelection(nextDashboard);
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load the progression atlas.');
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
  }, [personaId, city, location]);

  useEffect(() => {
    const packNodes = dashboard?.selectedPack?.nodes || [];
    const packEdges = dashboard?.selectedPack?.pack.edges || [];

    setPositions(buildGraphLayout(viewMode, packNodes, packEdges, GRAPH_WIDTH, GRAPH_HEIGHT));
    setViewport({ x: 0, y: 0, scale: 1 });
    setHoveredNodeId(null);
  }, [dashboard, viewMode]);

  useEffect(() => {
    if (typeof window === 'undefined' || !personaId) return;

    const params = new URLSearchParams(window.location.search);
    params.set('personaId', personaId);
    params.set('city', city);
    params.set('location', location);
    params.set('view', viewMode);
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  }, [personaId, city, location, viewMode]);

  useEffect(() => {
    const stopDragging = () => {
      dragStateRef.current = null;
    };

    window.addEventListener('pointerup', stopDragging);
    return () => {
      window.removeEventListener('pointerup', stopDragging);
    };
  }, []);

  const selectedPersona = useMemo(
    () => personas.find((persona) => persona.personaId === personaId) || null,
    [personas, personaId],
  );

  const selectedPack = dashboard?.selectedPack || null;
  const packNodes = selectedPack?.nodes || [];
  const packEdges = selectedPack?.pack.edges || [];
  const searchQuery = search.trim().toLowerCase();

  const visibleNodes = useMemo(() => {
    return packNodes.filter((entry) => {
      if (statusFilter !== 'all' && entry.state.status !== statusFilter) return false;
      if (!searchQuery) return true;

      const haystack = [
        entry.node.title,
        entry.node.description,
        entry.node.nodeId,
        entry.node.objectiveCategory,
        ...(entry.node.tags || []),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(searchQuery);
    });
  }, [packNodes, searchQuery, statusFilter]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((entry) => entry.node.nodeId)), [visibleNodes]);

  const visibleEdges = useMemo(() => {
    return packEdges.filter(
      (edge) =>
        edgeVisibility[edge.type] &&
        visibleNodeIds.has(edge.fromNodeId) &&
        visibleNodeIds.has(edge.toNodeId),
    );
  }, [edgeVisibility, packEdges, visibleNodeIds]);

  const selectedNode = useMemo(
    () => packNodes.find((entry) => entry.node.nodeId === selectedNodeId) || visibleNodes[0] || null,
    [packNodes, selectedNodeId, visibleNodes],
  );

  const focusNodeId = hoveredNodeId || selectedNode?.node.nodeId || null;

  const focusNodeIds = useMemo(() => {
    const next = new Set<string>();
    if (!focusNodeId) return next;

    next.add(focusNodeId);
    for (const edge of packEdges) {
      if (edge.fromNodeId === focusNodeId) next.add(edge.toNodeId);
      if (edge.toNodeId === focusNodeId) next.add(edge.fromNodeId);
    }
    return next;
  }, [focusNodeId, packEdges]);

  const orderedVisibleNodes = useMemo(() => {
    return [...visibleNodes].sort((left, right) => {
      const leftFocus = left.node.nodeId === focusNodeId ? 1 : 0;
      const rightFocus = right.node.nodeId === focusNodeId ? 1 : 0;
      return leftFocus - rightFocus;
    });
  }, [focusNodeId, visibleNodes]);

  const completedCount = useMemo(
    () => packNodes.filter((entry) => entry.state.status === 'validated' || entry.state.status === 'mastered').length,
    [packNodes],
  );

  const completionRatio = packNodes.length > 0 ? completedCount / packNodes.length : 0;

  const authoredCountByLevel = useMemo(() => {
    const counts = new Map<number, number>();

    for (const entry of packNodes) {
      counts.set(entry.node.level, (counts.get(entry.node.level) || 0) + 1);
    }

    return counts;
  }, [packNodes]);

  const spotlightObjectiveIds = useMemo(() => {
    return new Set(
      [
        dashboard?.lessonBundle.objectiveId,
        dashboard?.hangoutBundle.objectiveId,
        ...((dashboard?.nextActions || []).map((action) => action.objectiveId)),
      ].filter((objectiveId): objectiveId is string => Boolean(objectiveId)),
    );
  }, [dashboard]);

  const routeOptions = dashboard?.worldRoadmap || [];
  const viewCopy =
    viewMode === 'curriculum'
      ? 'Nodes sit in the exact progression band they belong to, so the skill tree reads like an RPG route.'
      : 'Nodes loosen into a dependency web so you can inspect prerequisites, bridges, and dense clusters.';
  const graphInstruction =
    viewMode === 'curriculum'
      ? 'Drag the canvas to pan. Scroll to zoom. Hover to spotlight. Click any node for details.'
      : 'Dependency view keeps the same data, but reveals the real chain of unlocks more clearly.';
  const primaryReason =
    dashboard?.languageSummary?.recommendedAction === 'hangout'
      ? dashboard.hangoutBundle.reason
      : dashboard?.languageSummary?.recommendedAction === 'mission'
        ? selectedPack?.missionGate?.reason || dashboard.lessonBundle.reason
        : dashboard?.lessonBundle.reason || selectedPack?.pack.summary || '';

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

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    dragStateRef.current = {
      type: 'pan',
      startX: event.clientX,
      startY: event.clientY,
      origin: viewport,
    };
  }

  function handleCanvasPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
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

  function handleNodePointerDown(event: ReactPointerEvent<SVGGElement>, nodeId: string) {
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

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const rect = graphRef.current?.getBoundingClientRect();
    if (!rect) return;

    const localX = ((event.clientX - rect.left) * GRAPH_WIDTH) / rect.width;
    const localY = ((event.clientY - rect.top) * GRAPH_HEIGHT) / rect.height;

    setViewport((current) => {
      const nextScale = clamp(current.scale * (event.deltaY < 0 ? 1.1 : 0.92), 0.55, 2.5);
      const graphX = (localX - current.x) / current.scale;
      const graphY = (localY - current.y) / current.scale;

      return {
        scale: nextScale,
        x: localX - graphX * nextScale,
        y: localY - graphY * nextScale,
      };
    });
  }

  return (
    <main className="app-shell app-shell--wide">
      {/* ── Compact nav ──────────────────────────── */}
      <nav className="dash-nav">
        <Link href="/">Home</Link>
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/graph"><strong>Graph</strong></Link>
        <Link href="/insights">Insights</Link>
        <Link href="/overlay">Overlay</Link>
        <Link href="/game">Game</Link>
      </nav>

      {/* ── Toolbar: route selectors + controls ──── */}
      <section className="dash-toolbar" style={{ marginBottom: 10 }}>
        <select className="dash-persona-select" value={personaId} onChange={(e) => setPersonaId(e.target.value)} disabled={loading}>
          {personas.map((p) => (
            <option key={p.personaId} value={p.personaId}>{p.displayName}</option>
          ))}
        </select>

        <select className="dash-persona-select" value={city} onChange={(e) => setCity(e.target.value as CityId)} style={{ minWidth: 120 }}>
          {routeOptions.map((c) => (
            <option key={c.cityId} value={c.cityId}>{c.label}</option>
          ))}
        </select>

        <select className="dash-persona-select" value={location} onChange={(e) => setLocation(e.target.value as LocationId)} style={{ minWidth: 140 }}>
          {(routeOptions.find((c) => c.cityId === city)?.locations || []).map((loc) => (
            <option key={loc.locationId} value={loc.locationId}>{loc.label}</option>
          ))}
        </select>

        <select className="dash-persona-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | GraphSelectedPackNode['state']['status'])} style={{ minWidth: 110 }}>
          <option value="all">All statuses</option>
          <option value="locked">Locked</option>
          <option value="available">Available</option>
          <option value="learning">Learning</option>
          <option value="due">Due</option>
          <option value="validated">Validated</option>
          <option value="mastered">Mastered</option>
        </select>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search nodes..."
          style={{ minWidth: 140, padding: '6px 10px', borderRadius: 14, border: '1px solid var(--line)', fontSize: 14 }}
        />

        <span className="pill">{percent(completionRatio)}% done</span>
        <span className="pill">{visibleNodes.length} nodes</span>
      </section>

      {/* ── Graph controls bar ───────────────────── */}
      <div className="graph-chip-row" style={{ marginBottom: 10, gap: 6 }}>
        <button type="button" className={`graph-chip ${viewMode === 'curriculum' ? 'graph-chip--active' : ''}`} onClick={() => setViewMode('curriculum')}>Skill tree</button>
        <button type="button" className={`graph-chip ${viewMode === 'dependency' ? 'graph-chip--active' : ''}`} onClick={() => setViewMode('dependency')}>Dependency web</button>
        <button type="button" className="graph-chip" onClick={() => setViewport({ x: 0, y: 0, scale: 1 })}>Reset camera</button>
        <span style={{ width: 1, height: 20, background: 'var(--line)', margin: '0 4px' }} />
        {(['requires', 'unlocks', 'reinforces'] as const).map((type) => (
          <button key={type} type="button" className={`graph-chip ${edgeVisibility[type] ? 'graph-chip--active' : ''}`} onClick={() => setEdgeVisibility((c) => ({ ...c, [type]: !c[type] }))}>{type}</button>
        ))}
      </div>

      {error && (
        <section className="card" style={{ marginBottom: 16 }}>
          <p style={{ color: '#9f1239' }}>{error}</p>
        </section>
      )}

      <section className="graph-route-layout" style={{ marginBottom: 16 }}>
        <article className="card stack">
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ marginBottom: 6 }}>Acrylic graph view</h3>
              <p>{viewCopy} Fill color tracks learner state, ring color tracks category, and every line is a real edge from the pack.</p>
            </div>
            <div className="graph-chip-row">
              <span className="pill">{visibleNodes.length} nodes</span>
              <span className="pill">{visibleEdges.length} edges</span>
              <span className="pill">{selectedPack?.pack.lang?.toUpperCase() || 'KO'}</span>
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
            {!loading && !packNodes.length && (
              <div className="graph-empty-state">
                <strong>No authored node graph is attached to this route yet.</strong>
                <span>Switch to another route or add the missing starter-pack nodes.</span>
              </div>
            )}
            {!loading && !!packNodes.length && (
              <>
                <div className="graph-canvas-badge">{graphInstruction}</div>
                <svg
                  className="graph-canvas"
                  viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
                  role="img"
                  aria-label="Interactive learner progression graph"
                >
                  <defs>
                    <marker id="graph-arrow-requires" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_TONES.requires.stroke} />
                    </marker>
                    <marker id="graph-arrow-unlocks" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_TONES.unlocks.stroke} />
                    </marker>
                    <marker id="graph-arrow-reinforces" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
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
                              fill={authoredCount > 0 ? 'rgba(255,255,255,0.034)' : 'rgba(255,255,255,0.012)'}
                              stroke="rgba(255,255,255,0.1)"
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
                            <text x={x} y={LEVEL_MARGIN_Y - 40} textAnchor="middle" fill="rgba(255,255,255,0.75)" fontSize="13" fontWeight="700">
                              Level {band.level}
                            </text>
                            <text x={x} y={LEVEL_MARGIN_Y - 22} textAnchor="middle" fill="rgba(255,255,255,0.48)" fontSize="11" fontWeight="600">
                              {band.label}
                            </text>
                            <text x={x} y={GRAPH_HEIGHT - LEVEL_MARGIN_Y + 38} textAnchor="middle" fill="rgba(255,255,255,0.42)" fontSize="11" fontWeight="600">
                              {authoredCount > 0 ? `${authoredCount} node${authoredCount === 1 ? '' : 's'}` : 'Unauthored'}
                            </text>
                          </g>
                        );
                      })}

                    {viewMode === 'dependency' && (
                      <>
                        <circle cx={GRAPH_WIDTH / 2} cy={GRAPH_HEIGHT / 2} r={124} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" strokeDasharray="8 10" />
                        <circle cx={GRAPH_WIDTH / 2} cy={GRAPH_HEIGHT / 2} r={208} fill="none" stroke="rgba(255,255,255,0.07)" strokeDasharray="8 12" />
                        <circle cx={GRAPH_WIDTH / 2} cy={GRAPH_HEIGHT / 2} r={292} fill="none" stroke="rgba(255,255,255,0.06)" strokeDasharray="8 14" />
                        <text x={GRAPH_WIDTH / 2} y={78} textAnchor="middle" fill="rgba(255,255,255,0.68)" fontSize="13" fontWeight="700">
                          Dependency web
                        </text>
                        <text x={GRAPH_WIDTH / 2} y={98} textAnchor="middle" fill="rgba(255,255,255,0.42)" fontSize="11" fontWeight="600">
                          This view surfaces how prerequisites and reinforcements truly connect.
                        </text>
                      </>
                    )}

                    {visibleEdges.map((edge) => {
                      const source = positions[edge.fromNodeId];
                      const target = positions[edge.toNodeId];
                      if (!source || !target) return null;

                      const isFocused = focusNodeId && (edge.fromNodeId === focusNodeId || edge.toNodeId === focusNodeId);
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
                      const categoryStroke = CATEGORY_TONES[entry.node.objectiveCategory || ''] || '#f8fafc';
                      const isFocused = focusNodeId ? focusNodeIds.has(entry.node.nodeId) : true;
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
                            setHoveredNodeId((current) => (current === entry.node.nodeId ? null : current));
                          }}
                          onPointerDown={(event) => handleNodePointerDown(event, entry.node.nodeId)}
                          style={{ opacity: isFocused ? 1 : 0.18, cursor: 'grab' }}
                        >
                          <circle r={radius + 11} fill={categoryStroke} opacity={isSelected ? 0.18 : 0.09} filter="url(#graph-glow)" />
                          <circle r={radius + 4} fill="rgba(7,12,24,0.55)" stroke={categoryStroke} strokeWidth={isSelected ? 4 : 2} />
                          <circle r={radius} fill={statusTone.fill} stroke={statusTone.stroke} strokeWidth={2.5} />
                          <text x={0} y={3} textAnchor="middle" fill={statusTone.ink} fontSize={12} fontWeight={700}>
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
                          <text x={0} y={radius + 26} textAnchor="middle" fill="#f8fafc" fontSize={12} fontWeight={600}>
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
                <h3 style={{ marginBottom: 6 }}>Now and next</h3>
                <p>These are the clearest user-facing answers to “what should I do next?”</p>
              </div>
              <span className="pill">{dashboard?.metrics.evidenceCount || 0} evidence</span>
            </div>

            <div className="graph-mini-list">
              <div className="graph-detail-card">
                <span className="kicker">Lesson lane</span>
                <strong>{dashboard?.lessonBundle.title || 'No lesson queued'}</strong>
                <span>{dashboard?.lessonBundle.reason || 'No lesson recommendation yet.'}</span>
              </div>
              <div className="graph-detail-card">
                <span className="kicker">Hangout lane</span>
                <strong>{dashboard?.hangoutBundle.title || 'No hangout queued'}</strong>
                <span>{dashboard?.hangoutBundle.reason || 'No hangout recommendation yet.'}</span>
              </div>
              {dashboard?.nextUnlocks?.map((unlock) => (
                <button
                  key={unlock.nodeId}
                  type="button"
                  className="graph-list-button"
                  onClick={() => setSelectedNodeId(unlock.nodeId)}
                >
                  <strong>{unlock.title}</strong>
                  <span>{unlock.reason}</span>
                </button>
              ))}
            </div>
          </article>

          <article className="card stack">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ marginBottom: 6 }}>Selected node</h3>
                <p>Click a node in either view to inspect blockers, evidence, and what it unlocks.</p>
              </div>
              {selectedNode && <StatusPill status={selectedNode.state.status} />}
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
                    <strong>{percent(selectedNode.state.masteryScore)}%</strong>
                  </div>
                  <div className="graph-detail-card">
                    <span className="kicker">Evidence</span>
                    <strong>{selectedNode.state.evidenceCount}</strong>
                  </div>
                  <div className="graph-detail-card">
                    <span className="kicker">Category</span>
                    <strong>{selectedNode.node.objectiveCategory}</strong>
                  </div>
                  <div className="graph-detail-card">
                    <span className="kicker">Last evidence</span>
                    <strong>{formatDateTime(selectedNode.state.lastEvidenceAt)}</strong>
                  </div>
                </div>

                {selectedNode.targetProgress && (
                  <div className="stack">
                    <span className="pill">Target completion</span>
                    <ProgressBar value={selectedNode.targetProgress.completionRatio} />
                    <p>
                      {selectedNode.targetProgress.completedTargetCount}/{selectedNode.targetProgress.totalTargetCount} targets cleared
                    </p>
                  </div>
                )}

                <div className="graph-chip-row">
                  {selectedNode.missionCritical && <span className="pill">Mission critical</span>}
                  {selectedNode.node.tags.map((tag) => (
                    <span key={tag} className="pill">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="stack">
                  <span className="pill">Blockers</span>
                  {selectedNode.state.blockerNodeIds.length > 0 ? (
                    <div className="graph-mini-list">
                      {selectedNode.state.blockerNodeIds.map((blockerNodeId) => {
                        const blocker = packNodes.find((entry) => entry.node.nodeId === blockerNodeId);
                        return (
                          <button
                            key={blockerNodeId}
                            type="button"
                            className="graph-list-button"
                            onClick={() => setSelectedNodeId(blockerNodeId)}
                          >
                            <strong>{blocker?.node.title || blockerNodeId}</strong>
                            <span>Required before this node can open.</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p>No blockers. This node is open right now.</p>
                  )}
                </div>

                {selectedNode.unlocksNodeIds && selectedNode.unlocksNodeIds.length > 0 && (
                  <div className="stack">
                    <span className="pill">Unlocks next</span>
                    <div className="graph-mini-list">
                      {selectedNode.unlocksNodeIds.map((unlockNodeId) => {
                        const unlock = packNodes.find((entry) => entry.node.nodeId === unlockNodeId);
                        return (
                          <button
                            key={unlockNodeId}
                            type="button"
                            className="graph-list-button"
                            onClick={() => setSelectedNodeId(unlockNodeId)}
                          >
                            <strong>{unlock?.node.title || unlockNodeId}</strong>
                            <span>{unlock?.node.description || 'Jump to downstream node.'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p>No node is selected yet.</p>
            )}
          </article>

          <article className="card stack">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ marginBottom: 6 }}>Legend</h3>
                <p>Color explains status and category. Edge color explains relation type.</p>
              </div>
            </div>

            <div className="graph-mini-list">
              {Object.entries(STATUS_TONES).map(([status, tone]) => (
                <div key={status} className="graph-legend-row">
                  <span className="graph-legend-swatch" style={{ background: tone.fill, borderColor: tone.stroke }} />
                  <span>{statusLabel(status)}</span>
                </div>
              ))}
            </div>

            <div className="graph-mini-list">
              {Object.entries(CATEGORY_TONES).map(([category, tone]) => (
                <div key={category} className="graph-legend-row">
                  <span className="graph-legend-swatch graph-legend-swatch--ring" style={{ borderColor: tone }} />
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
                        <line x1="2" y1="6" x2="52" y2="6" stroke={tone.stroke} strokeWidth="3" strokeDasharray={tone.dash} />
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

      <section className="card stack">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ marginBottom: 6 }}>Linear progression path</h3>
            <p>
              The graph above is the truth. This path below turns the same progression into a readable chapter flow so
              learners understand what they have, what is live now, and what unlocks after this.
            </p>
          </div>
          <div className="graph-chip-row">
            <span className="pill">{dashboard?.locationSkillTree.levels.length || 0} levels</span>
            <span className="pill">{dashboard?.metrics.validatedObjectives || 0} validated</span>
            <span className="pill">{dashboard?.metrics.masteredObjectives || 0} mastered</span>
          </div>
        </div>

        <div className="graph-linear-stack">
          {(dashboard?.locationSkillTree.levels || []).map((level, index) => {
            const isCurrentLevel =
              level.objectives.some((objective) => spotlightObjectiveIds.has(objective.objectiveId)) ||
              level.mission.status === 'tracking' ||
              level.mission.status === 'ready';

            return (
              <article
                key={level.level}
                className={`graph-level-card ${isCurrentLevel ? 'graph-level-card--active' : ''}`}
              >
                <div className="graph-level-rail" aria-hidden="true">
                  <span className="graph-level-index">{String(index + 1).padStart(2, '0')}</span>
                </div>

                <div className="graph-level-body">
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <div>
                      <span className="kicker">Level {level.level}</span>
                      <h3 style={{ marginBottom: 6 }}>{level.name}</h3>
                      <p>{level.description}</p>
                    </div>
                    <StatusPill status={level.mission.status} />
                  </div>

                  <div className="graph-chip-row">
                    <span className="pill">~{level.estimatedSessionMinutes} min</span>
                    <span className="pill">
                      Reward {level.mission.reward.xp} XP / {level.mission.reward.sp} SP / {level.mission.reward.rp} RP
                    </span>
                    {isCurrentLevel && <span className="pill">Current chapter</span>}
                  </div>

                  <div className="graph-detail-card">
                    <span className="kicker">Mission</span>
                    <strong>{level.mission.title}</strong>
                    <span>
                      {level.mission.requiredObjectiveIds.length} requirement{level.mission.requiredObjectiveIds.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="graph-level-objectives">
                    {level.objectives.map((objective) => {
                      const isFocus = spotlightObjectiveIds.has(objective.objectiveId);
                      const matchesGraphNode = packNodes.some((entry) => entry.node.nodeId === objective.objectiveId);

                      return (
                        <button
                          key={objective.objectiveId}
                          type="button"
                          className={`graph-objective-card ${isFocus ? 'graph-objective-card--focus' : ''}`}
                          onClick={() => {
                            if (matchesGraphNode) {
                              setSelectedNodeId(objective.objectiveId);
                            }
                          }}
                        >
                          <div className="row" style={{ alignItems: 'flex-start' }}>
                            <div className="graph-objective-copy">
                              <strong>{objective.title}</strong>
                              <span>{objective.description}</span>
                            </div>
                            <StatusPill status={objective.status} />
                          </div>

                          <div className="graph-chip-row">
                            <span className="pill">{objective.category}</span>
                            <span className="pill">
                              {objective.validatedTargetCount}/{objective.targetCount} targets
                            </span>
                            {objective.blockers.length > 0 && <span className="pill">{objective.blockers.length} blockers</span>}
                            {isFocus && <span className="pill">Up next</span>}
                          </div>

                          <ProgressBar value={objective.mastery_score} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
