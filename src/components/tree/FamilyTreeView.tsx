"use client";

import { useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { PersonData } from "@/types/models";
import { computeTreeLayout } from "@/lib/tree-layout";
import { formatBsDate } from "@/lib/nepali-date";
import { PersonNode } from "@/components/tree/PersonNode";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const nodeTypes: NodeTypes = { person: PersonNode };

interface FamilyTreeViewProps {
  people: PersonData[];
  onAddRelative?: (person: PersonData, type: "spouse" | "child") => void;
  onEdit?: (person: PersonData) => void;
  onDelete?: (person: PersonData) => void;
}

export function FamilyTreeView({ people, onAddRelative, onEdit, onDelete }: FamilyTreeViewProps) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const peopleById = useMemo(() => new Map(people.map((p) => [p._id, p])), [people]);
  // Derived from current data so the panel auto-closes if the selected person is deleted.
  const selected = selectedId ? peopleById.get(selectedId) ?? null : null;

  const { nodes, edges } = useMemo(() => {
    const layout = computeTreeLayout(people);
    return {
      nodes: layout.nodes.map((node) => ({
        ...node,
        data: { ...node.data, onSelect: (p: PersonData) => setSelectedId(p._id), onAddRelative, onDelete },
      })),
      edges: layout.edges,
    };
  }, [people, onAddRelative, onDelete]);

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return people.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [people, query]);

  if (people.length === 0) {
    return <p className="text-slate-500">No people have been added to this family yet.</p>;
  }

  return (
    <div className="relative h-[70vh] w-full overflow-hidden rounded-lg border border-slate-200">
      <div className="absolute left-3 top-3 z-10 w-64">
        <Input
          placeholder="Search for a person..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {matches.length > 0 && (
          <Card className="mt-1 max-h-60 overflow-auto">
            <CardContent className="p-1">
              {matches.map((person) => (
                <button
                  key={person._id}
                  type="button"
                  className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-slate-100"
                  onClick={() => {
                    setSelectedId(person._id);
                    setQuery("");
                  }}
                >
                  {person.name}
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {selected && (
        <Card className="absolute right-3 top-3 z-10 w-72">
          <CardHeader className="flex flex-row items-center justify-between">
            <span className="font-semibold">{selected.name}</span>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="text-slate-400 hover:text-slate-700"
              aria-label="Close"
            >
              ✕
            </button>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-600">
            {selected.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.photoUrl}
                alt={selected.name}
                className="mb-2 h-24 w-24 rounded-md object-cover"
              />
            )}
            <p>Gender: {selected.gender}</p>
            {selected.birthDate && <p>Born: {formatBsDate(selected.birthDate)} (B.S.)</p>}
            {selected.deathDate && <p>Died: {formatBsDate(selected.deathDate)} (B.S.)</p>}
            {selected.bio && <p className="pt-1">{selected.bio}</p>}
            {selected.spouses.length > 0 && (
              <p>
                Spouse(s):{" "}
                {selected.spouses
                  .map((id) => peopleById.get(id)?.name)
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
            {onEdit && (
              <Button size="sm" className="mt-2 w-full" onClick={() => onEdit(selected)}>
                Edit person
              </Button>
            )}
            {onDelete && (
              <Button
                size="sm"
                variant="destructive"
                className="w-full"
                onClick={() => {
                  onDelete(selected);
                  setSelectedId(null);
                }}
              >
                Delete person
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
