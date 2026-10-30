"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Baby, Heart, Trash2 } from "lucide-react";
import type { PersonData } from "@/types/models";
import { formatBsYear } from "@/lib/nepali-date";
import { genderClasses } from "@/lib/gender";

export type PersonNodeData = {
  person: PersonData;
  onSelect?: (person: PersonData) => void;
  onAddRelative?: (person: PersonData, type: "spouse" | "child") => void;
  onDelete?: (person: PersonData) => void;
};

export type PersonFlowNode = Node<PersonNodeData, "person">;

export function PersonNode({ data }: NodeProps<PersonFlowNode>) {
  const { person, onSelect, onAddRelative, onDelete } = data;
  const colors = genderClasses(person.gender);

  const years = [formatBsYear(person.birthDate), formatBsYear(person.deathDate)]
    .filter(Boolean)
    .join(" – ");

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onSelect?.(person)}
        className={`flex w-36 flex-col items-center gap-1 rounded-lg border p-2 text-center shadow-sm hover:border-slate-400 sm:w-44 ${colors.card}`}
      >
        <Handle type="target" position={Position.Top} />
        {person.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={person.photoUrl}
            alt={person.name}
            className="h-10 w-10 rounded-full object-cover ring-2 ring-white sm:h-12 sm:w-12"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 font-medium text-slate-500 ring-2 ring-white sm:h-12 sm:w-12">
            {person.name.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="text-sm font-medium text-slate-900">{person.name}</span>
        {years && <span className="text-xs text-slate-500">{years}</span>}
        <Handle type="source" position={Position.Bottom} />
      </button>

      {(onAddRelative || onDelete) && (
        <div className="pointer-events-none absolute -top-2 right-0 flex gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100">
          {onAddRelative && (
            <button
              type="button"
              title="Add spouse"
              onClick={(e) => {
                e.stopPropagation();
                onAddRelative(person, "spouse");
              }}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-500 shadow ring-1 ring-slate-200 hover:text-rose-600"
            >
              <Heart className="h-3.5 w-3.5" />
            </button>
          )}
          {onAddRelative && (
            <button
              type="button"
              title="Add child"
              onClick={(e) => {
                e.stopPropagation();
                onAddRelative(person, "child");
              }}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-500 shadow ring-1 ring-slate-200 hover:text-sky-600"
            >
              <Baby className="h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              title="Delete person"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(person);
              }}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-500 shadow ring-1 ring-slate-200 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
