"use client";

import { Handle, Position, type Node } from "@xyflow/react";

export type UnionFlowNode = Node<Record<string, never>, "union">;

// Size of the invisible junction point. It needs real dimensions: React Flow
// doesn't register handles (so draws no edges) on a zero-size node.
export const UNION_NODE_SIZE = 2;

// Invisible point where a couple's line meets the line down to their children.
export function UnionNode() {
  return (
    <div style={{ width: UNION_NODE_SIZE, height: UNION_NODE_SIZE }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} isConnectable={false} />
    </div>
  );
}
