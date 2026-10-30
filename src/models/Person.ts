import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const personSchema = new Schema(
  {
    familyId: { type: Schema.Types.ObjectId, ref: "Family", required: true, index: true },
    name: { type: String, required: true, trim: true },
    gender: { type: String, enum: ["male", "female", "other"], required: true },
    birthDate: { type: Date },
    deathDate: { type: Date },
    photoUrl: { type: String },
    bio: { type: String, trim: true },
    // Optional link to a login account; most people in a tree never log in.
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    parents: [{ type: Schema.Types.ObjectId, ref: "Person" }],
    spouses: [{ type: Schema.Types.ObjectId, ref: "Person" }],
  },
  { timestamps: true }
);

export type PersonDoc = InferSchemaType<typeof personSchema>;

export const Person: Model<PersonDoc> = models.Person ?? model<PersonDoc>("Person", personSchema);
