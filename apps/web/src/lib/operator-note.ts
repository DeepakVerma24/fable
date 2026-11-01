import { z } from 'zod';

export const operatorNoteSchema = z.object({
  note: z
    .string()
    .trim()
    .min(1, 'Write a note before saving it.')
    .max(280, 'Keep the note under 280 characters.'),
});

export type OperatorNote = z.infer<typeof operatorNoteSchema>;
