import { z } from 'zod';

export const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4307';

const healthSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('fable-api'),
  simulated: z.literal(true),
  realMoney: z.literal(false),
});

const moduleSchema = z.object({
  name: z.string(),
  role: z.string(),
  authoritativeForBalances: z.boolean(),
  mutatesBalances: z.boolean(),
});

const modulesSchema = z.object({
  simulated: z.literal(true),
  realMoney: z.literal(false),
  modules: z.array(moduleSchema),
});

export type HealthReport = z.infer<typeof healthSchema>;
export type ModuleReport = z.infer<typeof moduleSchema>;

async function getJson(path: string): Promise<unknown> {
  const response = await fetch(`${apiBase}${path}`);
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
  return response.json() as Promise<unknown>;
}

export async function fetchHealth(): Promise<HealthReport> {
  return healthSchema.parse(await getJson('/health'));
}

export async function fetchModules(): Promise<ModuleReport[]> {
  return modulesSchema.parse(await getJson('/modules')).modules;
}
