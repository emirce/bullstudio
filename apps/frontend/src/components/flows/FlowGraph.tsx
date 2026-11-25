"use client";

import {
  Background,
  Controls,
  type Edge,
  MarkerType,
  type Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo } from "react";
import "@xyflow/react/dist/style.css";
import type { FlowNode as FlowNodeType } from "@bullstudio/connect-types";
import { getStatusColor, type JobStatus } from "@bullstudio/ui/shared";
import dagre from "dagre";
import { FlowJobNode, type FlowJobNodeData } from "./FlowJobNode";

const nodeTypes = {
  flowJob: FlowJobNode,
};

const NODE_WIDTH = 240;
const NODE_HEIGHT = 92;

interface FlowGraphProps {
  root: FlowNodeType;
  onNodeClick: (jobId: string, queueName: string) => void;
  /** Tailwind height utility for the graph canvas. Defaults to the full-page height. */
  heightClassName?: string;
}

function buildNodesAndEdges(root: FlowNodeType): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  function traverse(node: FlowNodeType, parentId?: string) {
    const duration =
      node.finishedOn && node.processedOn
        ? node.finishedOn - node.processedOn
        : undefined;

    nodes.push({
      id: node.id,
      type: "flowJob",
      position: { x: 0, y: 0 },
      data: {
        name: node.name,
        status: node.status,
        queueName: node.queueName,
        duration,
      } as FlowJobNodeData,
    });

    if (parentId) {
      const isActive = node.status === "active" || node.status === "waiting";
      const statusColor = getStatusColor(node.status as JobStatus);

      edges.push({
        id: `${parentId}-${node.id}`,
        source: parentId,
        target: node.id,
        type: "smoothstep",
        animated: isActive,
        style: {
          stroke: statusColor,
          strokeWidth: 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: statusColor,
          width: 20,
          height: 20,
        },
      });
    }

    if (node.children) {
      for (const child of node.children) {
        traverse(child, node.id);
      }
    }
  }

  traverse(root);
  return { nodes, edges };
}

function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction = "TB",
): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 64,
    ranksep: 88,
    marginx: 40,
    marginy: 40,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

export function FlowGraph({
  root,
  onNodeClick,
  heightClassName = "h-[calc(100vh-260px)] min-h-[520px]",
}: FlowGraphProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const { nodes, edges } = buildNodesAndEdges(root);
    return getLayoutedElements(nodes, edges);
  }, [root]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const nodeData = node.data as FlowJobNodeData;
      onNodeClick(node.id, nodeData.queueName);
    },
    [onNodeClick],
  );

  useEffect(() => {
    const { nodes, edges } = buildNodesAndEdges(root);
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges,
    );
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [root, setNodes, setEdges]);

  return (
    <div
      className={`${heightClassName} overflow-hidden rounded-lg border bg-card/80`}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: "16%" }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: "smoothstep",
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          gap={24}
          size={1}
          color="var(--border)"
          className="bg-muted/30"
        />
        <Controls
          showInteractive={false}
          className="!rounded-md !border-border !bg-card !shadow-lg [&>button]:!border-border [&>button]:!bg-card [&>button]:!text-muted-foreground [&>button:hover]:!bg-muted"
        />
      </ReactFlow>
    </div>
  );
}
