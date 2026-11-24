export { scan, isDead, deadCutoff, ScanError, type ScanDeps } from './scan.ts';
export { parseScanInput, describeInput, InputError } from './input.ts';
export { parseDepSpec, resolveRange, type DepSpec } from './resolve.ts';
export { HOSTS, upstreamUrl, Upstream, UpstreamError, DEFAULT_LIMITS, type HostId, type FetchLike, type Limits } from './upstream.ts';
export { getYearOfDownloads, summarizePackage } from './sources.ts';
