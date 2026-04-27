import { z } from 'zod';

const safeUrl = z.string()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), 'Only HTTP and HTTPS URLs are allowed');

const mailingListAddress = z.string().email().or(safeUrl);

/**
 * Accept either a {url, description?} object or a bare URL string for back-compat.
 * Coerced to {url, description} on parse.
 */
function makeLinkSchema(urlSchema: z.ZodTypeAny) {
  const linkObject = z.object({
    url: urlSchema,
    description: z.string().max(200).optional().default(''),
  });
  return z.union([
    linkObject,
    urlSchema.transform((url: string) => ({ url, description: '' })),
  ]);
}

const linkSchema             = makeLinkSchema(safeUrl);
const mailingListLinkSchema  = makeLinkSchema(mailingListAddress);

/** Accept Link[] or single Link or single URL string; always returns Link[]. */
function makeLinkArraySchema(itemSchema: z.ZodTypeAny) {
  return z.union([
    z.array(itemSchema),
    itemSchema.transform((v: unknown) => [v]),
  ]).optional().default([]);
}

export const linksFields = {
  jira:        makeLinkArraySchema(linkSchema),
  confluence:  makeLinkArraySchema(linkSchema),
  github:      makeLinkArraySchema(linkSchema),
  mailingList: makeLinkArraySchema(mailingListLinkSchema),
};
