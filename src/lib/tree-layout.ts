import type { Edge } from "@xyflow/react";
import type { PersonData } from "@/types/models";
import type { PersonFlowNode } from "@/components/tree/PersonNode";
import type { UnionFlowNode } from "@/components/tree/UnionNode";
import { compareBirthOrder } from "@/lib/siblings";

// Every person node is PERSON_NODE_WIDTH wide inside a SLOT_WIDTH slot; the gap
// between two slots is where a couple's line down to their children drops.
export const PERSON_NODE_WIDTH = 176;
const SLOT_WIDTH = 210;
const LEVEL_HEIGHT = 210;
// Height (from a node's top) of the couple line and the side handles it uses.
export const SPOUSE_LINE_Y = 36;
// Where the junction of a couple that isn't side by side sits below their row.
const BRACKET_Y = 122;

export type TreeNode = PersonFlowNode | UnionFlowNode;

const unionKeyOf = (parentIds: string[]) => [...parentIds].sort().join("|");

// Computes a generation (row) for each person via relaxation: a child must be
// one level below its deepest parent, and spouses must always share a level
// (so someone marrying into the family lines up with their partner's row).
// Repeats until stable since bumping one person can cascade to their spouse's
// side of the family and down to their children.
function computeLevels(people: PersonData[], spousesById: Map<string, string[]>): Map<string, number> {
  const byId = new Map(people.map((p) => [p._id, p]));
  const levels = new Map<string, number>(people.map((p) => [p._id, 0]));

  for (let i = 0; i <= people.length; i++) {
    let changed = false;

    for (const person of people) {
      for (const parentId of person.parents) {
        if (!byId.has(parentId)) continue;
        const required = (levels.get(parentId) ?? 0) + 1;
        if ((levels.get(person._id) ?? 0) < required) {
          levels.set(person._id, required);
          changed = true;
        }
      }
    }

    for (const person of people) {
      for (const spouseId of spousesById.get(person._id) ?? []) {
        const a = levels.get(person._id) ?? 0;
        const b = levels.get(spouseId) ?? 0;
        if (a !== b) {
          const shared = Math.max(a, b);
          levels.set(person._id, shared);
          levels.set(spouseId, shared);
          changed = true;
        }
      }
    }

    if (!changed) break;
  }

  return levels;
}

// Lays people out as a tidy family tree, measured in slots. Each "unit" is a
// person plus their spouse(s) in one row; their children's units go in a block
// below and the couple is centered over that block, so children always sit under
// their own parents. With several marriages the spouses alternate right and left
// of the person (e.g. Wife2, Husband, Wife1) so every couple is side by side with
// its own line. Children are ordered by which couple they belong to (left to
// right), then by birth order.
function computeSlots(people: PersonData[], spousesById: Map<string, string[]>): Map<string, number> {
  const byId = new Map(people.map((p) => [p._id, p]));
  const childrenOf = new Map<string, PersonData[]>();
  for (const person of people) {
    for (const parentId of person.parents) {
      if (!byId.has(parentId)) continue;
      const list = childrenOf.get(parentId) ?? [];
      list.push(person);
      childrenOf.set(parentId, list);
    }
  }
  const hasParents = (p: PersonData) => p.parents.some((id) => byId.has(id));

  const slots = new Map<string, number>();
  const visited = new Set<string>();

  // Places `person`'s unit starting at slot `left`; returns its width and every id placed.
  function place(person: PersonData, left: number): { width: number; ids: string[] } {
    visited.add(person._id);
    const spouses: PersonData[] = [];
    for (const spouseId of spousesById.get(person._id) ?? []) {
      const spouse = byId.get(spouseId)!;
      if (visited.has(spouseId)) continue;
      visited.add(spouseId);
      spouses.push(spouse);
    }
    const leftSpouses = spouses.filter((_, i) => i % 2 === 1).reverse();
    const rightSpouses = spouses.filter((_, i) => i % 2 === 0);
    const couple = [...leftSpouses, person, ...rightSpouses];
    const indexInCouple = new Map(couple.map((p, i) => [p._id, i]));

    const children = new Map<string, PersonData>();
    for (const member of couple) {
      for (const child of childrenOf.get(member._id) ?? []) {
        if (!visited.has(child._id)) children.set(child._id, child);
      }
    }
    // Anchor = average position of the child's parents within this couple row.
    const anchorOf = (child: PersonData) => {
      const positions = child.parents
        .filter((id) => indexInCouple.has(id))
        .map((id) => indexInCouple.get(id)!);
      return positions.reduce((sum, x) => sum + x, 0) / positions.length;
    };
    const sortedChildren = [...children.values()].sort((a, b) => {
      const anchorDiff = anchorOf(a) - anchorOf(b);
      if (anchorDiff !== 0) return anchorDiff;
      const keyA = unionKeyOf(a.parents);
      const keyB = unionKeyOf(b.parents);
      if (keyA !== keyB) return keyA < keyB ? -1 : 1;
      return compareBirthOrder(a, b);
    });

    const childIds: string[] = [];
    let cursor = left;
    for (const child of sortedChildren) {
      if (visited.has(child._id)) continue;
      const placed = place(child, cursor);
      cursor += placed.width;
      childIds.push(...placed.ids);
    }
    const childrenWidth = cursor - left;
    const width = Math.max(childrenWidth, couple.length);

    const childShift = (width - childrenWidth) / 2;
    if (childShift > 0) {
      for (const id of childIds) slots.set(id, slots.get(id)! + childShift);
    }
    const coupleLeft = left + (width - couple.length) / 2;
    couple.forEach((member, i) => slots.set(member._id, coupleLeft + i));

    return { width, ids: [...couple.map((p) => p._id), ...childIds] };
  }

  // Founders (no parents, not married into the family) start the walk; anyone
  // still unplaced afterwards (e.g. disconnected entries) is appended. Among a
  // founding couple, the partner with more marriages (then the male) goes first
  // so they end up in the middle/left with spouses beside them.
  const spouseCount = (p: PersonData) => spousesById.get(p._id)?.length ?? 0;
  const founders = people
    .filter((p) => !hasParents(p))
    .filter((p) => !(spousesById.get(p._id) ?? []).some((id) => hasParents(byId.get(id)!)))
    .sort(
      (a, b) =>
        spouseCount(b) - spouseCount(a) ||
        Number(b.gender === "male") - Number(a.gender === "male") ||
        compareBirthOrder(a, b)
    );
  let cursor = 0;
  for (const person of [...founders, ...[...people].sort(compareBirthOrder)]) {
    if (visited.has(person._id)) continue;
    cursor += place(person, cursor).width;
  }
  return slots;
}

const UNION_COLORS = ["#0ea5e9", "#f97316", "#8b5cf6", "#10b981", "#ec4899", "#eab308"];
const DEFAULT_EDGE_COLOR = "#94a3b8";

// Assigns a subtle, stable color per "set of parents" (union), but only for
// parents who have children with more than one partner - e.g. a father with
// kids from two mothers gets each mother's lineage drawn in a different color,
// so you can tell half-siblings apart at a glance without any extra labels.
function computeUnionColors(people: PersonData[]): Map<string, string> {
  const byId = new Map(people.map((p) => [p._id, p]));
  const parentUnions = new Map<string, Set<string>>();
  const unionKeys = new Set<string>();

  for (const person of people) {
    const validParents = person.parents.filter((id) => byId.has(id));
    if (validParents.length === 0) continue;
    const key = unionKeyOf(validParents);
    unionKeys.add(key);
    for (const parentId of validParents) {
      const set = parentUnions.get(parentId) ?? new Set<string>();
      set.add(key);
      parentUnions.set(parentId, set);
    }
  }

  const ambiguousKeys = new Set<string>();
  for (const unions of parentUnions.values()) {
    if (unions.size > 1) {
      for (const key of unions) ambiguousKeys.add(key);
    }
  }

  const colorByKey = new Map<string, string>();
  let colorIndex = 0;
  for (const key of unionKeys) {
    if (ambiguousKeys.has(key)) {
      colorByKey.set(key, UNION_COLORS[colorIndex % UNION_COLORS.length]);
      colorIndex++;
    }
  }

  return colorByKey;
}

export function computeTreeLayout(people: PersonData[]): {
  nodes: TreeNode[];
  edges: Edge[];
} {
  const byId = new Map(people.map((p) => [p._id, p]));

  // Spouse links counted from either side (older data may store only one side).
  const spousesById = new Map<string, string[]>(people.map((p) => [p._id, []]));
  const link = (a: string, b: string) => {
    const list = spousesById.get(a)!;
    if (!list.includes(b)) list.push(b);
  };
  for (const person of people) {
    for (const spouseId of person.spouses) {
      if (!byId.has(spouseId) || spouseId === person._id) continue;
      link(person._id, spouseId);
      link(spouseId, person._id);
    }
  }

  const levels = computeLevels(people, spousesById);
  const slots = computeSlots(people, spousesById);
  const xOf = (id: string) => (slots.get(id) ?? 0) * SLOT_WIDTH;
  const yOf = (id: string) => (levels.get(id) ?? 0) * LEVEL_HEIGHT;
  const sideBySide = (a: string, b: string) =>
    levels.get(a) === levels.get(b) && Math.abs(Math.abs((slots.get(a) ?? 0) - (slots.get(b) ?? 0)) - 1) < 1e-6;

  const nodes: TreeNode[] = people.map((person) => ({
    id: person._id,
    type: "person",
    position: { x: xOf(person._id), y: yOf(person._id) },
    data: { person },
  }));
  const edges: Edge[] = [];
  const unionColors = computeUnionColors(people);

  // Couple lines, always drawn from the left partner's right side to the right partner's left side.
  for (const [personId, spouseIds] of spousesById) {
    for (const spouseId of spouseIds) {
      if (personId > spouseId) continue;
      const [leftId, rightId] = xOf(personId) <= xOf(spouseId) ? [personId, spouseId] : [spouseId, personId];
      edges.push({
        id: `spouse-${personId}-${spouseId}`,
        source: leftId,
        sourceHandle: "spouse-right",
        target: rightId,
        targetHandle: "spouse-left",
        type: sideBySide(leftId, rightId) ? "straight" : "smoothstep",
        style: { stroke: DEFAULT_EDGE_COLOR, strokeWidth: 1.5 },
      });
    }
  }

  // Children hang from one junction per set of parents: the middle of the couple
  // line when the parents sit side by side, or a point below their row (joined by
  // a line from each parent) otherwise. A single parent connects directly.
  const childrenByUnion = new Map<string, PersonData[]>();
  for (const person of people) {
    const validParents = person.parents.filter((id) => byId.has(id));
    if (validParents.length === 0) continue;
    const key = unionKeyOf(validParents);
    const list = childrenByUnion.get(key) ?? [];
    list.push(person);
    childrenByUnion.set(key, list);
  }

  for (const [key, children] of childrenByUnion) {
    const parentIds = key.split("|");
    const color = unionColors.get(key);
    const style = { stroke: color ?? DEFAULT_EDGE_COLOR, strokeWidth: color ? 2 : 1.5 };

    let sourceId = parentIds[0];
    if (parentIds.length > 1) {
      const isCouple = parentIds.length === 2 && sideBySide(parentIds[0], parentIds[1]);
      const centerX = parentIds.reduce((sum, id) => sum + xOf(id), 0) / parentIds.length + PERSON_NODE_WIDTH / 2;
      const rowY = Math.max(...parentIds.map(yOf));
      sourceId = `union-${key}`;
      nodes.push({
        id: sourceId,
        type: "union",
        position: { x: centerX, y: rowY + (isCouple ? SPOUSE_LINE_Y : BRACKET_Y) },
        data: {},
        selectable: false,
        draggable: false,
      });
      if (!isCouple) {
        for (const parentId of parentIds) {
          edges.push({ id: `bracket-${parentId}-${key}`, source: parentId, target: sourceId, type: "smoothstep", style });
        }
      }
    }

    for (const child of children) {
      edges.push({ id: `child-${key}-${child._id}`, source: sourceId, target: child._id, type: "smoothstep", style });
    }
  }

  return { nodes, edges };
}
