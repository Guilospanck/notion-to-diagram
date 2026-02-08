'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Background,
  Panel,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
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

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<{
    title: string;
    content: string;
  } | null>(null);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showReferences, setShowReferences] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    layoutDiagram(diagramData, 'TB').then((result) => {
      setNodes(result.nodes);
      setEdges(result.edges);
      setReady(true);
    });
  }, [diagramData, setNodes, setEdges]);

  const visibleEdges = useMemo(() => {
    if (showReferences) return edges;
    return edges.filter((e) => !e.animated);
  }, [edges, showReferences]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const data = node.data as { label: string; fullContent: string };
    setSelectedNode({ title: data.label, content: data.fullContent });
  }, []);

  const onRelayout = useCallback(
    async (direction: 'TB' | 'LR') => {
      const result = await layoutDiagram(diagramData, direction);
      setNodes(result.nodes);
      setEdges(result.edges);
      setTimeout(() => fitView({ padding: 0.2 }), 50);
    },
    [diagramData, setNodes, setEdges, fitView],
  );

  if (!ready) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400">
        Laying out diagram...
      </div>
    );
  }

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
