"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { PersonData } from "@/types/models";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface PeoplePickerProps {
  people: PersonData[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}

export function PeoplePicker({ people, selected, onChange, placeholder = "Search by name..." }: PeoplePickerProps) {
  const [query, setQuery] = useState("");

  const selectedPeople = selected
    .map((id) => people.find((p) => p._id === id))
    .filter((p): p is PersonData => Boolean(p));

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return people
      .filter((p) => !selected.includes(p._id) && p.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [people, query, selected]);

  function add(id: string) {
    onChange([...selected, id]);
    setQuery("");
  }

  function remove(id: string) {
    onChange(selected.filter((x) => x !== id));
  }

  return (
    <div className="space-y-2">
      {selectedPeople.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedPeople.map((p) => (
            <Badge key={p._id} className="bg-slate-900 text-white">
              {p.name}
              <button type="button" onClick={() => remove(p._id)} aria-label={`Remove ${p.name}`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={people.length === 0 ? "No other people yet" : placeholder}
          disabled={people.length === 0}
        />
        {matches.length > 0 && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-md">
            {matches.map((p) => (
              <button
                key={p._id}
                type="button"
                onClick={() => add(p._id)}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100"
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
