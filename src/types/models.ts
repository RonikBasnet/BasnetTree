export type Gender = "male" | "female" | "other";

export interface PersonData {
  _id: string;
  familyId: string;
  name: string;
  gender: Gender;
  birthDate?: string | null;
  deathDate?: string | null;
  photoUrl?: string | null;
  bio?: string | null;
  userId?: string | null;
  parents: string[];
  spouses: string[];
  // Birth order (1..n) among siblings sharing a parent (lower = older).
  order: number;
}

export interface FamilyData {
  _id: string;
  name: string;
  description?: string | null;
  createdBy: string;
}
