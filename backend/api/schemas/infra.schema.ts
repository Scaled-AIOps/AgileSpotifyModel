/**
 * Purpose: Zod schema for InfraCluster create.
 * Usage:   Imported by infra.routes.ts and passed to the `validate(...)` middleware.
 * Goal:    Validate cluster inputs at the API boundary; tags arrive as a free-form
 *          object and are JSON-serialised by the route handler.
 */
import { z } from 'zod';

export const createInfraSchema = z.object({
  platformId:    z.string().min(1).regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers and hyphens'),
  name:          z.string().min(1).max(120),
  description:   z.string().optional().default(''),
  clusterId:     z.string().min(1),
  environment:   z.string().min(1),
  host:          z.string().min(1),
  routeHostName: z.string().optional().default(''),
  platform:      z.string().min(1),
  platformType:  z.string().min(1),
  tokenId:       z.string().optional().default(''),
  tags:          z.record(z.string()).optional().default({}),
});
