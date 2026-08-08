import { z } from 'zod';

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default('Bersama'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3004'),
  NEXT_PUBLIC_SUPPORTED_LOCALES: z.string().default('en,vi'),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.string().default('en'),
  NEXT_PUBLIC_LOCALE_PREFIX: z.enum(['always', 'as-needed', 'never']).default('as-needed'),
});

const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPPORTED_LOCALES: process.env.NEXT_PUBLIC_SUPPORTED_LOCALES,
  NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
  NEXT_PUBLIC_LOCALE_PREFIX: process.env.NEXT_PUBLIC_LOCALE_PREFIX,
});

if (!parsed.success) {
  console.error('❌ Invalid public environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid public environment variables');
}

export const publicEnv = parsed.data;
