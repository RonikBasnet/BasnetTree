"use client";

import { useRef, useState, type FormEvent } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { NepaliDateInput } from "@/components/ui/nepali-date-input";
import { PeoplePicker } from "@/components/admin/PeoplePicker";
import { genderClasses } from "@/lib/gender";
import { assumedParents, spousesOf } from "@/lib/spouses";
import type { PersonData } from "@/types/models";

interface PersonFormProps {
  familyId: string;
  people: PersonData[];
  existingPerson?: PersonData | null;
  presetParents?: string[];
  presetSpouses?: string[];
  onSaved: (person: PersonData) => void;
  onCancel: () => void;
}

export function PersonForm({
  familyId,
  people,
  existingPerson,
  presetParents,
  presetSpouses,
  onSaved,
  onCancel,
}: PersonFormProps) {
  const [name, setName] = useState(existingPerson?.name ?? "");
  const [gender, setGender] = useState(existingPerson?.gender ?? "other");
  const [birthDate, setBirthDate] = useState(existingPerson?.birthDate?.slice(0, 10) ?? "");
  const [deathDate, setDeathDate] = useState(existingPerson?.deathDate?.slice(0, 10) ?? "");
  const [bio, setBio] = useState(existingPerson?.bio ?? "");
  const [photoUrl, setPhotoUrl] = useState(existingPerson?.photoUrl ?? "");
  const [parents, setParents] = useState<string[]>(existingPerson?.parents ?? presetParents ?? []);
  const [spouses, setSpouses] = useState<string[]>(existingPerson?.spouses ?? presetSpouses ?? []);
  const [birthOrder, setBirthOrder] = useState(
    existingPerson ? String(existingPerson.order) : ""
  );
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectablePeople = people.filter((p) => p._id !== existingPerson?._id);

  // When a single parent is picked, assume their spouse is the other parent if
  // they have exactly one (multiple marriages are left to the suggestions below).
  function handleParentsChange(next: string[]) {
    const added = next.filter((id) => !parents.includes(id));
    if (next.length === 1 && added.length === 1) {
      const assumed = assumedParents(people, added[0]).filter((id) => id !== existingPerson?._id);
      setParents(assumed);
      return;
    }
    setParents(next);
  }

  // With exactly one parent selected, offer that parent's spouses as the other parent.
  const otherParentSuggestions =
    parents.length === 1
      ? spousesOf(people, parents[0])
          .filter((id) => id !== existingPerson?._id)
          .map((id) => people.find((p) => p._id === id)!)
      : [];

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setPhotoUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        familyId,
        name,
        gender,
        birthDate: birthDate || undefined,
        deathDate: deathDate || undefined,
        bio: bio || undefined,
        photoUrl: photoUrl || undefined,
        parents,
        spouses,
        order: birthOrder.trim() === "" ? undefined : Number(birthOrder),
      };
      const url = existingPerson ? `/api/people/${existingPerson._id}` : "/api/people";
      const method = existingPerson ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save person");
      const saved = await res.json();
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`group relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-slate-200 ${genderClasses(gender).bg}`}
          aria-label="Upload photo"
        >
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className={`flex h-full w-full items-center justify-center text-xl font-medium ${genderClasses(gender).text}`}>
              {name.charAt(0).toUpperCase() || "?"}
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
          </span>
        </button>
        <div className="flex-1 space-y-1">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoChange}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="gender">Gender</Label>
        <Select
          id="gender"
          value={gender}
          onChange={(e) => setGender(e.target.value as PersonData["gender"])}
        >
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="birthDate">Born (B.S.)</Label>
          <NepaliDateInput id="birthDate" value={birthDate} onChange={setBirthDate} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="deathDate">Died (B.S., optional)</Label>
          <NepaliDateInput id="deathDate" value={deathDate} onChange={setDeathDate} />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A short note about this person..." />
      </div>

      <div className="space-y-4 rounded-lg border border-slate-200 p-4">
        <p className="text-sm font-semibold text-slate-700">Link to family members</p>
        <div className="space-y-1">
          <Label>Parents</Label>
          <PeoplePicker people={selectablePeople} selected={parents} onChange={handleParentsChange} />
          {otherParentSuggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-slate-500">
              <span>Other parent:</span>
              {otherParentSuggestions.map((spouse) => (
                <button
                  key={spouse._id}
                  type="button"
                  className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-700 hover:bg-slate-100"
                  onClick={() => setParents([...parents, spouse._id])}
                >
                  + {spouse.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-1">
          <Label>Spouse(s)</Label>
          <PeoplePicker people={selectablePeople} selected={spouses} onChange={setSpouses} />
        </div>
        {parents.length > 0 && (
          <div className="space-y-1">
            <Label htmlFor="birthOrder">Birth order among siblings</Label>
            <Input
              id="birthOrder"
              type="number"
              value={birthOrder}
              onChange={(e) => setBirthOrder(e.target.value)}
              placeholder="Lower number = older. Leave blank to add at the end."
            />
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || uploading}>
          {submitting ? "Saving..." : existingPerson ? "Save changes" : "Add person"}
        </Button>
      </div>
    </form>
  );
}
