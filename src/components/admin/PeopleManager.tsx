"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, Network, Pencil, Plus, Search, Trash2, Users, ChevronUp, ChevronDown, Download, Upload, Loader2, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { PersonForm } from "@/components/admin/PersonForm";
import { FamilyTreeView } from "@/components/tree/FamilyTreeView";
import { formatBsYear } from "@/lib/nepali-date";
import { genderClasses } from "@/lib/gender";
import { computeSiblingGroups, renumberGroup } from "@/lib/siblings";
import { assumedParents } from "@/lib/spouses";
import type { PersonData } from "@/types/models";

interface RelationPreset {
  parents?: string[];
  spouses?: string[];
}

export function PeopleManager({
  familyId,
  initialPeople,
}: {
  familyId: string;
  initialPeople: PersonData[];
}) {
  const router = useRouter();
  const [people, setPeople] = useState(initialPeople);
  // Re-sync with fresh server data after router.refresh(), since saves can also
  // update other people (spouse back-links, sibling renumbering).
  const [syncedInitialPeople, setSyncedInitialPeople] = useState(initialPeople);
  if (initialPeople !== syncedInitialPeople) {
    setSyncedInitialPeople(initialPeople);
    setPeople(initialPeople);
  }
  const [editing, setEditing] = useState<PersonData | null | undefined>(undefined);
  const [preset, setPreset] = useState<RelationPreset>({});
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "tree">("list");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<
    { error: string } | { created: number; updated: number; warnings: string[] } | null
  >(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const peopleById = useMemo(() => new Map(people.map((p) => [p._id, p])), [people]);

  // Groups people sharing a parent (siblings, incl. half-siblings), sorted by birth order.
  const siblingGroups = useMemo(() => computeSiblingGroups(people), [people]);

  async function handleReorder(person: PersonData, direction: "up" | "down") {
    const group = siblingGroups.get(person._id) ?? [];
    const index = group.findIndex((p) => p._id === person._id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || swapIndex < 0 || swapIndex >= group.length) return;
    // Renumber the whole group 1..n (rather than swapping raw values) so siblings
    // that share a duplicate order still move.
    const position = swapIndex + 1;
    const orders = renumberGroup(group, person._id, position);

    setPeople((prev) =>
      prev.map((p) => (orders.has(p._id) ? { ...p, order: orders.get(p._id)! } : p))
    );

    await fetch(`/api/people/${person._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: position }),
    });
    router.refresh();
  }

  const filteredPeople = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => p.name.toLowerCase().includes(q));
  }, [people, query]);

  function openAddDialog(relationPreset: RelationPreset = {}) {
    setPreset(relationPreset);
    setEditing(null);
  }

  function closeDialog() {
    setEditing(undefined);
    setPreset({});
  }

  function handleSaved(person: PersonData) {
    setPeople((prev) => {
      const exists = prev.some((p) => p._id === person._id);
      return exists ? prev.map((p) => (p._id === person._id ? person : p)) : [...prev, person];
    });
    closeDialog();
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this person? This cannot be undone.")) return;
    const res = await fetch(`/api/people/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPeople((prev) => prev.filter((p) => p._id !== id));
      router.refresh();
    }
  }

  // Adding a child links the person's spouse as the second parent when they have
  // exactly one; with multiple marriages the form asks which spouse is the other parent.
  function handleAddRelative(person: PersonData, type: "spouse" | "child") {
    if (type === "spouse") {
      openAddDialog({ spouses: [person._id] });
    } else {
      openAddDialog({ parents: assumedParents(people, person._id) });
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch(`/api/families/${familyId}/csv`, {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: await file.text(),
      });
      const data = await res.json();
      setImportResult(res.ok ? data : { error: data.error ?? "Import failed" });
      if (res.ok) router.refresh();
    } catch {
      setImportResult({ error: "Import failed" });
    } finally {
      setImporting(false);
    }
  }

  function relationshipSummary(person: PersonData) {
    const parentNames = person.parents.map((id) => peopleById.get(id)?.name).filter(Boolean);
    const spouseNames = person.spouses.map((id) => peopleById.get(id)?.name).filter(Boolean);
    const childNames = people
      .filter((p) => p.parents.includes(person._id))
      .map((p) => p.name);

    const parts: string[] = [];
    if (parentNames.length) parts.push(`Parents: ${parentNames.join(", ")}`);
    if (spouseNames.length) parts.push(`Spouse: ${spouseNames.join(", ")}`);
    if (childNames.length) parts.push(`Children: ${childNames.join(", ")}`);
    return parts;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-slate-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-medium ${
                view === "list" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              List
            </button>
            <button
              type="button"
              onClick={() => setView("tree")}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-medium ${
                view === "tree" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Network className="h-3.5 w-3.5" />
              Tree
            </button>
          </div>
          {view === "list" && (
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people..."
                className="pl-9"
              />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/families/${familyId}/csv`}
            download
            title="Download everyone as a CSV file"
            className={buttonVariants({ variant: "outline", className: "gap-1.5" })}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </a>
          <Button
            variant="outline"
            className="gap-1.5"
            disabled={importing}
            onClick={() => importInputRef.current?.click()}
            title="Add or update people from a CSV file (same columns as the export)"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import CSV
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImport}
          />
          <Button onClick={() => openAddDialog()} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add person
          </Button>
        </div>
      </div>

      {importResult && (
        <div
          className={`relative rounded-lg border p-3 pr-9 text-sm ${
            "error" in importResult
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          <button
            type="button"
            onClick={() => setImportResult(null)}
            className="absolute right-2 top-2 text-current opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
          {"error" in importResult ? (
            <p>{importResult.error}</p>
          ) : (
            <>
              <p>
                Import finished: {importResult.created} added, {importResult.updated} updated.
              </p>
              {importResult.warnings.length > 0 && (
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-amber-700">
                  {importResult.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {view === "tree" ? (
        people.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 py-12 text-center">
            <Users className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">No people added yet.</p>
            <Button size="sm" onClick={() => openAddDialog()}>
              Add the first person
            </Button>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-400">
              Hover a card to add their spouse or child directly. Different edge colors mark
              children from different partners of the same parent.
            </p>
            <FamilyTreeView
              people={people}
              onAddRelative={handleAddRelative}
              onEdit={setEditing}
              onDelete={(person) => handleDelete(person._id)}
              onReorder={handleReorder}
            />
          </>
        )
      ) : filteredPeople.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 py-12 text-center">
          <Users className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">
            {people.length === 0 ? "No people added yet." : "No matches for your search."}
          </p>
          {people.length === 0 && (
            <Button size="sm" onClick={() => openAddDialog()}>
              Add the first person
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPeople.map((person) => {
            const years = [formatBsYear(person.birthDate), formatBsYear(person.deathDate)]
              .filter(Boolean)
              .join(" \u2013 ");
            const summary = relationshipSummary(person);
            const siblingGroup = siblingGroups.get(person._id) ?? [];
            const siblingIndex = siblingGroup.findIndex((p) => p._id === person._id);
            return (
              <Card key={person._id} className={genderClasses(person.gender).card}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    {person.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={person.photoUrl}
                        alt={person.name}
                        className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-white"
                      />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/70 font-medium text-slate-500 ring-2 ring-white">
                        {person.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{person.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <Badge className="bg-white/70 text-slate-600">{person.gender}</Badge>
                        {years && <span className="text-xs text-slate-500">{years}</span>}
                      </div>
                    </div>
                  </div>

                  {summary.length > 0 && (
                    <div className="space-y-0.5 border-t border-black/5 pt-2 text-xs text-slate-600">
                      {summary.map((line) => (
                        <p key={line} className="truncate">
                          {line}
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {siblingGroup.length > 1 && (
                      <div className="flex flex-col gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-5 w-7 bg-white/70 p-0"
                          disabled={siblingIndex <= 0}
                          title="Move up in birth order"
                          onClick={() => handleReorder(person, "up")}
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-5 w-7 bg-white/70 p-0"
                          disabled={siblingIndex === -1 || siblingIndex >= siblingGroup.length - 1}
                          title="Move down in birth order"
                          onClick={() => handleReorder(person, "down")}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1.5 bg-white/70"
                      onClick={() => setEditing(person)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1.5"
                      onClick={() => handleDelete(person._id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={editing !== undefined}
        onClose={closeDialog}
        title={editing ? `Edit ${editing.name}` : "Add person"}
      >
        {editing !== undefined && (
          <PersonForm
            familyId={familyId}
            people={people}
            existingPerson={editing}
            presetParents={preset.parents}
            presetSpouses={preset.spouses}
            onSaved={handleSaved}
            onCancel={closeDialog}
          />
        )}
      </Dialog>
    </div>
  );
}

