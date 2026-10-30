import { z } from "zod";

export const familyInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().trim().optional(),
});

export const personInputSchema = z.object({
  familyId: z.string().min(1, "Family is required"),
  name: z.string().trim().min(1, "Name is required"),
  gender: z.enum(["male", "female", "other"]),
  birthDate: z.string().optional(),
  deathDate: z.string().optional(),
  photoUrl: z.string().optional(),
  bio: z.string().trim().optional(),
  parents: z.array(z.string()).optional(),
  spouses: z.array(z.string()).optional(),
});
