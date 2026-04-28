/**
 * Purpose: Public /info endpoint exposing build-time metadata.
 * Usage:   Mounted by app.ts at top level (alongside /health). Reads
 *          dist/package.json (emitted by webpack's BuildInfoPlugin) and
 *          returns name / version / commitId / branch / buildTime.
 * Goal:    Give monitoring, deploy verification, and on-call tooling a cheap
 *          unauthenticated way to confirm which build is running.
 * ToDo:    —
 */
import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

interface BuildInfo {
  name:      string;
  version:   string;
  commitId:  string;
  branch:    string;
  buildTime: string;
}

const FALLBACK: BuildInfo = {
  name: 'unknown', version: 'dev', commitId: '', branch: '', buildTime: '',
};

/**
 * Resolved once at module load. Looks for the metadata file emitted by webpack
 * (dist/package.json) in the most likely locations:
 *   1. Next to the bundled server.js → __dirname/package.json (production)
 *   2. dist/package.json relative to the cwd (dev after `npm run build`)
 *   3. The plain backend/package.json (dev / ts-node) — gives name+version only
 */
function loadBuildInfo(): BuildInfo {
  const candidates = [
    path.resolve(__dirname, 'package.json'),
    path.resolve(process.cwd(), 'dist/package.json'),
    path.resolve(process.cwd(), 'package.json'),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      return {
        name:      typeof raw.name      === 'string' ? raw.name      : FALLBACK.name,
        version:   typeof raw.version   === 'string' ? raw.version   : FALLBACK.version,
        commitId:  typeof raw.commitId  === 'string' ? raw.commitId  : FALLBACK.commitId,
        branch:    typeof raw.branch    === 'string' ? raw.branch    : FALLBACK.branch,
        buildTime: typeof raw.buildTime === 'string' ? raw.buildTime : FALLBACK.buildTime,
      };
    } catch { /* try next candidate */ }
  }
  return FALLBACK;
}

const buildInfo = loadBuildInfo();

const router = Router();
router.get('/', (_req: Request, res: Response) => res.json(buildInfo));

export default router;
