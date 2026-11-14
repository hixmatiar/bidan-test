import { z } from 'zod';

const username = z.string().trim().min(3).max(50);
const password = z.string().min(8);

export const loginSchema = z.object({
  username,
  password,
});

export const resetRequestSchema = z.object({
  username,
});

export const resetVerifySchema = z.object({
  username,
  kode: z.string().regex(/^\d{6}$/, 'Kode OTP harus 6 digit'),
  password_baru: password,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ResetRequestInput = z.infer<typeof resetRequestSchema>;
export type ResetVerifyInput = z.infer<typeof resetVerifySchema>;
