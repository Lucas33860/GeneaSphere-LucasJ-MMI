import { z } from "zod";

export const memberSchema = z.object({
  first_name: z.string().min(1, "Le prénom est requis").max(100),
  last_name: z.string().min(1, "Le nom est requis").max(100),
  gender: z.enum(["male", "female", "other"]).nullable().optional(),
  birth_date: z.string().date().nullable().optional(),
  death_date: z.string().date().nullable().optional(),
  birth_place: z.string().max(200).nullable().optional(),
  bio: z.string().max(5000).nullable().optional(),
  is_private: z.boolean().optional().default(false),
  father_id: z.string().uuid().nullable().optional(),
  mother_id: z.string().uuid().nullable().optional(),
});

export type MemberInput = z.infer<typeof memberSchema>;
