'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Background,
  Panel,
  useNodesState,
  useEdgesState,
  type Node,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import CustomNode from './CustomNode';
import DetailPanel from './DetailPanel';
import Toolbar from './Toolbar';
import { layoutDiagram } from '@/lib/layout';
import type { DiagramData } from '@/types';

const nodeTypes = { custom: CustomNode };

function DiagramCanvasInner({ diagramData }: { diagramData: DiagramData }) {
  const { fitView } = useReactFlow();

  const initialLayout = useMemo(
    () => layoutDiagram(diagramData, 'TB'),
    [diagramData],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialLayout.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialLayout.edges);
  const [selectedNode, setSelectedNode] = useState<{
    title: string;
    content: string;
  } | null>(null);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showReferences, setShowReferences] = useState(true);

  const visibleEdges = useMemo(() => {
    if (showReferences) return edges;
    return edges.filter((e) => !e.animated);
  }, [edges, showReferences]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const data = node.data as { label: string; fullContent: string };
    setSelectedNode({ title: data.label, content: data.fullContent });
  }, []);

  const onRelayout = useCallback(
    (direction: 'TB' | 'LR') => {
      const result = layoutDiagram(diagramData, direction);
      setNodes(result.nodes);
      setEdges(result.edges);
      setTimeout(() => fitView({ padding: 0.2 }), 50);
    },
    [diagramData, setNodes, setEdges, fitView],
  );

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={visibleEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
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
            onToggleReferences={() => setShowReferences((v) => !v)}
            onRelayout={onRelayout}
            showMinimap={showMinimap}
            showReferences={showReferences}
          />
        </Panel>
      </ReactFlow>
      {selectedNode && (
        <DetailPanel
          title={selectedNode.title}
          content={selectedNode.content}
          onClose={() => setSelectedNode(null)}
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
