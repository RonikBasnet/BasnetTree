import type { Edge } from "@xyflow/react";
import type { PersonData } from "@/types/models";
import type { PersonFlowNode } from "@/components/tree/PersonNode";

const NODE_WIDTH = 200;
const LEVEL_HEIGHT = 160;

// Sorts siblings (people sharing the exact same set of parents) by their `order`
// field, while leaving the relative order of different sibling groups and of
// people with no parents untouched (based on where each group first appears).
function sortSiblingsByOrder(people: PersonData[]): PersonData[] {
  const byId = new Map(people.map((p) => [p._id, p]));
  const groupKeyOf = new Map<string, string>();
  const groupFirstIndex = new Map<string, number>();

  people.forEach((person, index) => {
    const validParents = person.parents.filter((id) => byId.has(id));
    const key = validParents.length > 0 ? [...validParents].sort().join("|") : `__single-${person._id}`;
    groupKeyOf.set(person._id, key);
    if (!groupFirstIndex.has(key)) groupFirstIndex.set(key, index);
  });

  return people
    .map((person, index) => ({ person, index }))
    .sort((a, b) => {
      const groupA = groupFirstIndex.get(groupKeyOf.get(a.person._id)!)!;
      const groupB = groupFirstIndex.get(groupKeyOf.get(b.person._id)!)!;
      if (groupA !== groupB) return groupA - groupB;
      const orderA = a.person.order ?? a.index;
      const orderB = b.person.order ?? b.index;
      if (orderA !== orderB) return orderA - orderB;
      return a.index - b.index;
    })
    .map((x) => x.person);
}

// Computes a generation (row) for each person via relaxation: a child must be
// one level below its deepest parent, and spouses must always share a level
// (so someone marrying into the family lines up with their partner's row).
// Repeats until stable since bumping one person can cascade to their spouse's
// side of the family and down to their children.
function computeLevels(people: PersonData[]): Map<string, number> {
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
      for (const spouseId of person.spouses) {
        if (!byId.has(spouseId)) continue;
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

// Keeps spouses next to each other within a row instead of scattered by insertion order.
function orderWithSpousesAdjacent(peopleInLevel: PersonData[]): PersonData[] {
  const byId = new Map(peopleInLevel.map((p) => [p._id, p]));
  const visited = new Set<string>();
  const ordered: PersonData[] = [];

  for (const person of peopleInLevel) {
    if (visited.has(person._id)) continue;
    visited.add(person._id);
    ordered.push(person);

    for (const spouseId of person.spouses) {
      const spouse = byId.get(spouseId);
      if (spouse && !visited.has(spouseId)) {
        visited.add(spouseId);
        ordered.push(spouse);
      }
    }
  }

  return ordered;
}

const UNION_COLORS = ["#0ea5e9", "#f97316", "#8b5cf6", "#10b981", "#ec4899", "#eab308"];
const DEFAULT_EDGE_COLOR = "#cbd5e1";

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
    const key = [...validParents].sort().join("|");
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

export function computeTreeLayout(rawPeople: PersonData[]): {
  nodes: PersonFlowNode[];
  edges: Edge[];
} {
  const people = sortSiblingsByOrder(rawPeople);
  const levels = computeLevels(people);
  const byLevel = new Map<number, PersonData[]>();
  for (const person of people) {
    const level = levels.get(person._id) ?? 0;
    const bucket = byLevel.get(level) ?? [];
    bucket.push(person);
    byLevel.set(level, bucket);
  }

  const nodes: PersonFlowNode[] = [];
  for (const [level, peopleInLevel] of byLevel) {
    const ordered = orderWithSpousesAdjacent(peopleInLevel);
    ordered.forEach((person, index) => {
      nodes.push({
        id: person._id,
        type: "person",
        position: { x: index * NODE_WIDTH, y: level * LEVEL_HEIGHT },
        data: { person },
      });
    });
  }

  const edges: Edge[] = [];
  const unionColors = computeUnionColors(people);
  const byId = new Map(people.map((p) => [p._id, p]));

  for (const person of people) {
    const validParents = person.parents.filter((id) => byId.has(id));
    const unionKey = validParents.length > 0 ? [...validParents].sort().join("|") : null;
    const color = unionKey ? unionColors.get(unionKey) : undefined;

    for (const parentId of validParents) {
      edges.push({
        id: `parent-${parentId}-${person._id}`,
        source: parentId,
        target: person._id,
        type: "smoothstep",
        style: { stroke: color ?? DEFAULT_EDGE_COLOR, strokeWidth: color ? 2 : 1.5 },
      });
    }
    for (const spouseId of person.spouses) {
      // Avoid adding the same spouse pair twice.
      if (person._id < spouseId) {
        edges.push({
          id: `spouse-${person._id}-${spouseId}`,
          source: person._id,
          target: spouseId,
          type: "straight",
          style: { strokeDasharray: "4 4", stroke: DEFAULT_EDGE_COLOR },
        });
      }
    }
  }

  return { nodes, edges };
}
