import { z } from "zod";

const name = z.string().trim().min(1, "Name is required").max(80, "Name must be at most 80 characters");
const description = z.string().trim().max(500, "Description must be at most 500 characters");

export const createProjectSchema = z.object({
  name,
  description: description.default(""),
});

export const updateProjectSchema = z
  .object({ name: name.optional(), description: description.optional() })
  .refine((v) => v.name !== undefined || v.description !== undefined, {
    message: "Provide a name or description to update",
  });
