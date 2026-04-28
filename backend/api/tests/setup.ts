// Ensures env vars are present before any module is imported.
// vitest.config.ts `env` block handles this at the runner level,
// but this file can be used for any global test helpers.

import { vi } from 'vitest';

// Silence console.error in tests unless specifically asserted.
vi.spyOn(console, 'error').mockImplementation(() => {});
