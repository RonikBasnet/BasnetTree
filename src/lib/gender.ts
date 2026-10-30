import type { Gender } from "@/types/models";

// Soft, consistent color coding for gender used across cards and badges.
export function genderClasses(gender: Gender) {
  switch (gender) {
    case "male":
      return {
        bg: "bg-sky-100",
        text: "text-sky-700",
        ring: "ring-sky-200",
        card: "bg-sky-50 border-sky-200",
      };
    case "female":
      return {
        bg: "bg-pink-100",
        text: "text-pink-700",
        ring: "ring-pink-200",
        card: "bg-pink-50 border-pink-200",
      };
    default:
      return {
        bg: "bg-purple-100",
        text: "text-purple-700",
        ring: "ring-purple-200",
        card: "bg-purple-50 border-purple-200",
      };
  }
}
