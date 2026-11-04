import { z } from "zod";

export const idSchema = z.coerce.number().int().positive();

export const idParams = z.object({ id: idSchema });
export const projectIdParams = z.object({ projectId: idSchema });
