import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  NEXT_PUBLIC_APP_NAME: z.string().default('Bersama'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3004'),

  DRIZZLE_DATABASE_URL: z.string().url(),

  STELLAR_NETWORK: z.enum(['testnet', 'public', 'futurenet']).default('public'),
  NEXT_PUBLIC_STELLAR_NETWORK: z.enum(['testnet', 'public', 'futurenet']).default('public'),
  STELLAR_HORIZON_URL: z.string().url().default('https://horizon.stellar.org'),
  STELLAR_NETWORK_PASSPHRASE: z.string().default('Test SDF Network ; September 2015'),
  SOROBAN_RPC_URL: z.string().url().default('https://soroban-rpc.creit.tech'),

  // Matched-donation pool Soroban contract (testnet) + the native XLM SAC it settles in.
  MATCH_POOL_CONTRACT_ID: z
    .string()
    .min(56)
    .default('CCSHXAYAZ42OZK6JTXSTDDV3UAOTKRCM6UFNYYT4NM2HWB4S3Z4W3H67'),
  NEXT_PUBLIC_MATCH_POOL_CONTRACT_ID: z
    .string()
    .min(56)
    .default('CCSHXAYAZ42OZK6JTXSTDDV3UAOTKRCM6UFNYYT4NM2HWB4S3Z4W3H67'),
  XLM_SAC_CONTRACT_ID: z
    .string()
    .min(56)
    .default('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'),
  NEXT_PUBLIC_XLM_SAC_CONTRACT_ID: z
    .string()
    .min(56)
    .default('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'),
  APP_CONTRACT_ID: z
    .string()
    .min(56)
    .default('CDYRUMJ4WMWRGTFKWNUTFR3UE2T5VTQ64REVXOKUZPF6AH25NGE2P5OO'),

  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 chars'),
  SESSION_COOKIE_NAME: z.string().default('bersama_session'),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  NONCE_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  USDC_ASSET_CODE: z.string().default('USDC'),
  USDC_ASSET_ISSUER_TESTNET: z
    .string()
    .default('GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'),
  USDC_ASSET_ISSUER_PUBLIC: z
    .string()
    .default('GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'),
  NEXT_PUBLIC_USDC_ISSUER: z
    .string()
    .default('GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'),

  DEMO_MODE: z.coerce.boolean().default(true),
  SSE_MAX_CONCURRENT_PER_IP: z.coerce.number().int().positive().default(10),
  IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().positive().default(86400),

  NEXT_PUBLIC_SUPPORTED_LOCALES: z.string().default('en,vi'),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.string().default('en'),
  NEXT_PUBLIC_LOCALE_PREFIX: z.enum(['always', 'as-needed', 'never']).default('as-needed'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

const rawEnv = parsed.data;

export const USDC_ASSET_ISSUER_VALUE: string = (() => {
  if (rawEnv.STELLAR_NETWORK === 'public') return rawEnv.USDC_ASSET_ISSUER_PUBLIC;
  return rawEnv.USDC_ASSET_ISSUER_TESTNET;
})();

export const env = rawEnv;
export type Env = typeof env;
