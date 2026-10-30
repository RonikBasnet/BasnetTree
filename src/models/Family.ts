import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const familySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export type FamilyDoc = InferSchemaType<typeof familySchema>;

export const Family: Model<FamilyDoc> = models.Family ?? model<FamilyDoc>("Family", familySchema);
