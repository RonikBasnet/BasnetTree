"use client";

import { Handle, Position, type Node } from "@xyflow/react";

export type UnionFlowNode = Node<Record<string, never>, "union">;

// Invisible zero-size point where a couple's line meets the line down to their
// children; its position is the junction itself.
export function UnionNode() {
  return (
    <div className="h-0 w-0">
      <Handle type="target" position={Position.Top} style={{ opacity: 0, top: 0, left: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, top: 0, left: 0 }} />
    </div>
  );
}
