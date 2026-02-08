import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Background,
  Panel,
  useNodesState,
  useEdgesState,
  type Node,
  type ColorMode,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import CustomNode from './CustomNode';
import DetailPanel from './DetailPanel';
import Toolbar from './Toolbar';
import { layoutDiagram, type LayoutDirection } from '@/lib/layout';
import type { DiagramData } from '@/types';

const nodeTypes = { custom: CustomNode };

function useColorMode(): ColorMode {
  const [colorMode, setColorMode] = useState<ColorMode>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setColorMode(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return colorMode;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isMobile;
}

function DiagramCanvasInner({ diagramData }: { diagramData: DiagramData }) {
  const { fitView, setCenter, getNode } = useReactFlow();
  const colorMode = useColorMode();
  const isMobile = useIsMobile();

  const initialLayout = useMemo(
    () => layoutDiagram(diagramData, 'TB'),
    [diagramData],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialLayout.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialLayout.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<{
    title: string;
    content: string;
  } | null>(null);
  const [showMinimap, setShowMinimap] = useState(!isMobile);

  const selectNode = useCallback((nodeId: string) => {
    const rfNode = getNode(nodeId);
    if (!rfNode) return;
    const data = rfNode.data as { label: string; fullContent: string };
    setSelectedNodeId(nodeId);
    setSelectedNode({ title: data.label, content: data.fullContent });
    // Center viewport on the node
    setCenter(
      rfNode.position.x + (rfNode.measured?.width ?? 200) / 2,
      rfNode.position.y + (rfNode.measured?.height ?? 50) / 2,
      { zoom: 1.2, duration: 400 },
    );
  }, [getNode, setCenter]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    selectNode(node.id);
  }, [selectNode]);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedNode(null);
  }, []);

  const onRelayout = useCallback(
    (direction: LayoutDirection) => {
      const result = layoutDiagram(diagramData, direction);
      setNodes(result.nodes);
      setEdges(result.edges);
      setTimeout(() => fitView({ padding: 0.2 }), 50);
    },
    [diagramData, setNodes, setEdges, fitView],
  );

  // Mark selected node in data so CustomNode can highlight it
  const styledNodes = useMemo(() =>
    nodes.map((n) => ({
      ...n,
      data: { ...n.data, selected: n.id === selectedNodeId },
    })),
    [nodes, selectedNodeId],
  );

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={styledNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        colorMode={colorMode}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background />
        {showMinimap && <MiniMap />}
        <Panel position="top-left">
          <Toolbar
            onFitView={() => fitView({ padding: 0.2 })}
            onToggleMinimap={() => setShowMinimap((v) => !v)}
            onRelayout={onRelayout}
            showMinimap={showMinimap}
          />
        </Panel>
      </ReactFlow>
      {selectedNode && (
        <DetailPanel
          title={selectedNode.title}
          content={selectedNode.content}
          onClose={() => {
            setSelectedNodeId(null);
            setSelectedNode(null);
          }}
          onNavigateToNode={selectNode}
        />
      )}
    </div>
  );
}

export default function DiagramCanvas({ diagramData }: { diagramData: DiagramData }) {
  return (
    <ReactFlowProvider>
      <DiagramCanvasInner diagramData={diagramData} />
    </ReactFlowProvider>
  );
}
