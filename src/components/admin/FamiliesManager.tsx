"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Trash2, TreePine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import type { FamilyData } from "@/types/models";

export function FamiliesManager({ initialFamilies }: { initialFamilies: FamilyData[] }) {
  const router = useRouter();
  const [families, setFamilies] = useState(initialFamilies);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/families", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error?.formErrors?.[0] ?? "Failed to create family");
      }
      const created = await res.json();
      setFamilies((prev) => [...prev, created]);
      setName("");
      setDescription("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this family and all its people? This cannot be undone.")) return;
    const res = await fetch(`/api/families/${id}`, { method: "DELETE" });
    if (res.ok) {
      setFamilies((prev) => prev.filter((f) => f._id !== id));
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-3 p-4">
          <h2 className="font-semibold">Create a new family tree</h2>
          <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="Family name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create"}
            </Button>
          </form>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {families.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 py-12 text-center">
          <TreePine className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">No families yet. Create one above.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {families.map((family) => (
            <Card key={family._id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="min-w-0">
                  <Link href={`/admin/families/${family._id}`} className="font-medium text-slate-900 hover:underline">
                    {family.name}
                  </Link>
                  {family.description && (
                    <p className="truncate text-sm text-slate-500">{family.description}</p>
                  )}
                </div>
                <Button variant="destructive" size="sm" className="gap-1.5 shrink-0" onClick={() => handleDelete(family._id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
