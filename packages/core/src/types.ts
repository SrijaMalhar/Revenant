// Shared shapes. The web app, the MCP server and the scripts all speak these,
// so a report scanned in the browser can be handed to the agent unchanged.

// ---------- Graveyard ----------
export type ScanInput =
  | { kind: 'github'; owner: string; repo: string; ref?: string }
  | { kind: 'manifest'; packageJson: string };

/** key: `${name}@${version}` */
export interface PackageId {
  name: string;
  version: string;
}

export interface Vitals {
  latestVersion: string; // deps.dev version with isDefault = true
  lastRelease: string; // ISO date, newest publishedAt across all versions
  maintainers: number | null; // fetched only for dead packages, else null
  deprecated: string | null; // deprecation message on the installed version
  installScripts: boolean; // hasInstallScript on the installed version
  weeklyDownloads: number | null;
  advisories: string[]; // OSV ids open at the installed version
  firstRelease?: string; // ISO, oldest publishedAt
  releasesByYear?: { year: number; count: number }[];
}

export interface Replacement {
  manifest: 'native' | 'micro-utilities' | 'preferred';
  replacements: string[]; // e.g. ['URL', 'uri-js-replace', 'fast-uri']
}

export interface GraveNode extends PackageId {
  depth: number; // 0 = direct dependency
  path: string[]; // root -> ... -> this node, as name@version
  dev: boolean; // reached only through devDependencies
  vitals: Vitals;
  dead: boolean; // lastRelease <= scannedAt - 3 years
  replacement: Replacement | null;
  /** true when one of the dead-only detail calls failed */
  incomplete?: boolean;
}

export interface GraveyardReport {
  input: ScanInput;
  scannedAt: string; // ISO, UTC
  root: { name: string; deps: number; devDeps: number };
  nodes: GraveNode[]; // sorted by name, then version
  errors: { at: string; message: string }[];
  truncated: boolean; // true if the node cap or time budget was hit
  source: 'live' | 'demo';
}

export interface ZombieScore {
  total: number; // integer 0-100
  parts: { abandonment: number; attackSurface: number; reach: number };
  action: 'replace' | 'revive' | 'watch';
  explain: string[]; // one line per factor, shown in the drawer
}

// ---------- Soul Match ----------
export type Outcome =
  | { kind: 'ok'; value: unknown } // value already projected and canonicalised
  | { kind: 'throw'; name: string }; // error class name, compared only if asked

export interface Case<I = unknown> {
  name: string; // e.g. 'normalize'
  arbitrary: import('fast-check').Arbitrary<I>;
  call: (mod: any, input: I) => unknown; // how to invoke the module
  project?: (value: unknown) => unknown; // reduce a result to observable data
  compareErrorClass?: boolean;
  /** inputs in a declared-divergence domain are skipped and counted */
  allow?: (input: I) => boolean;
  /** turns typed text from the Ouija board into an input for this case */
  parse?: (text: string) => I;
  /** one-click edge-case chips for the Ouija board */
  examples?: string[];
}

export interface Divergence {
  caseName: string;
  input: unknown; // after shrinking
  original: Outcome;
  candidate: Outcome;
  shrinks: number;
  /** every failing input met while shrinking, first to last (for the animation) */
  path?: unknown[];
  counterexamplePath?: string;
  runSeed?: number;
}

export interface SoulMatchRun {
  pkg: string;
  target: 'revived' | 'replay' | 'possessed';
  seed: number;
  numRuns: number;
  done: number;
  status: 'running' | 'same-soul' | 'diverged' | 'error';
  divergence?: Divergence;
  perCase?: { name: string; runs: number; skipped: number }[];
  millis: number;
  error?: string;
}

export interface Soulprint {
  pkg: string;
  version: string;
  fastCheck: string; // exact fast-check version used
  seed: number;
  n: number;
  sha256: string;
  tz: 'UTC';
}

export interface Provenance {
  source: 'deps.dev' | 'npm' | 'ci' | 'build';
  at: string; // ISO date
  detail?: string;
}

export interface OssuaryManifest {
  name: string;
  version: string;
  integrity: string; // dist.integrity from the registry
  license: string;
  author: string;
  main?: string; // entry inside original/
  cases: string[]; // case names exported by cases.ts
  divergences: { id: string; description: string; test: string }[];
  replay?: { draft: string; recordedAt: string; note: string };
  build?: { define?: Record<string, string> };
  possessions?: { id: string; title: string; caught?: boolean; caseName?: string | null; inputsToCatch?: number | null; shrinks?: number | null; note?: string; measuredAt?: string }[];
  coverage?: {
    lines: number;
    branches: number;
    seed: number;
    measuredAt: string;
    uncovered: string[];
  };
  redos?: {
    originalVulnerable: number;
    revivedVulnerable: number;
    checker: string;
    measuredAt: string;
    originalFindings?: { file: string; pattern: string; complexity: string }[];
  };
  mutation?: { score: number; killed: number; survived: number; total: number; measuredAt: string };
  inputStats?: Record<string, number>;
  traceability?: { id: string; text: string; tests: { name: string; status: 'pass' | 'fail' }[] }[];
  delta?: {
    subtreePackages: [number, number];
    installScripts: [number, number];
    maintainerAccounts: [number, number];
    gzipBytes: [number, number];
    opsPerSec: [number, number];
    measuredAt: string;
  };
  referee?: {
    against: 'node:path.posix';
    agree: number;
    total: number;
    examples: { caseName: string; input: unknown; original: Outcome; node: Outcome }[];
    measuredAt?: string;
  };
  soulprint?: { original: string; revived: string; n: number; seed: number; fastCheck: string };
}
