/**
 * path-browserify, revived.
 *
 * A zero-dependency TypeScript reimplementation of path-browserify 1.0.1,
 * which itself ports the POSIX half of Node's `path` module (Node 8.11.1).
 * It aims to behave exactly like that original on every input, including
 * its quirks, so it can replace it without changing any caller's results.
 */

const SLASH = 47; // '/'
const DOT = 46; // '.'

export interface ParsedPath {
  root: string;
  dir: string;
  base: string;
  ext: string;
  name: string;
}

export interface FormatInputPathObject {
  root?: string;
  dir?: string;
  base?: string;
  name?: string;
  ext?: string;
}

function assertPath(path: unknown): asserts path is string {
  if (typeof path !== 'string') {
    let shown: string;
    try {
      shown = String(JSON.stringify(path));
    } catch {
      shown = typeof path;
    }
    throw new TypeError('Path must be a string. Received ' + shown);
  }
}

function currentDir(): string {
  const proc = (globalThis as { process?: { cwd?: () => string } }).process;
  return proc && typeof proc.cwd === 'function' ? proc.cwd() : '/';
}

/** Resolves "." and ".." segments. With allowAboveRoot, leading ".." segments are kept. */
function normalizeSegments(path: string, allowAboveRoot: boolean): string {
  let res = '';
  let lastSegmentLength = 0;
  let lastSlash = -1;
  let dots = 0;
  let code = 0;
  for (let i = 0; i <= path.length; ++i) {
    if (i < path.length) code = path.charCodeAt(i);
    else if (code === SLASH) break;
    else code = SLASH;

    if (code !== SLASH) {
      dots = code === DOT && dots !== -1 ? dots + 1 : -1;
      continue;
    }

    if (lastSlash === i - 1 || dots === 1) {
      // empty segment or "." — nothing to add
    } else if (dots === 2) {
      const endsWithDotDot =
        res.length >= 2 &&
        lastSegmentLength === 2 &&
        res.charCodeAt(res.length - 1) === DOT &&
        res.charCodeAt(res.length - 2) === DOT;
      let popped = false;
      if (!endsWithDotDot) {
        if (res.length > 2) {
          const lastSlashIndex = res.lastIndexOf('/');
          if (lastSlashIndex !== res.length - 1) {
            if (lastSlashIndex === -1) {
              res = '';
              lastSegmentLength = 0;
            } else {
              res = res.slice(0, lastSlashIndex);
              lastSegmentLength = res.length - 1 - res.lastIndexOf('/');
            }
            popped = true;
          }
        } else if (res.length === 2 || res.length === 1) {
          res = '';
          lastSegmentLength = 0;
          popped = true;
        }
      }
      if (popped) {
        lastSlash = i;
        dots = 0;
        continue;
      }
      if (allowAboveRoot) {
        res = res.length > 0 ? res + '/..' : '..';
        lastSegmentLength = 2;
      }
    } else {
      const seg = path.slice(lastSlash + 1, i);
      res = res.length > 0 ? res + '/' + seg : seg;
      lastSegmentLength = i - lastSlash - 1;
    }
    lastSlash = i;
    dots = 0;
  }
  return res;
}

export function resolve(...paths: string[]): string {
  let resolved = '';
  let absolute = false;
  for (let i = paths.length - 1; i >= -1 && !absolute; i--) {
    const path = i >= 0 ? paths[i] : currentDir();
    assertPath(path);
    if (path.length === 0) continue;
    resolved = path + '/' + resolved;
    absolute = path.charCodeAt(0) === SLASH;
  }
  resolved = normalizeSegments(resolved, !absolute);
  if (absolute) return resolved.length > 0 ? '/' + resolved : '/';
  return resolved.length > 0 ? resolved : '.';
}

export function normalize(path: string): string {
  assertPath(path);
  if (path.length === 0) return '.';
  const absolute = path.charCodeAt(0) === SLASH;
  const trailingSeparator = path.charCodeAt(path.length - 1) === SLASH;
  let out = normalizeSegments(path, !absolute);
  if (out.length === 0 && !absolute) out = '.';
  if (out.length > 0 && trailingSeparator) out += '/';
  return absolute ? '/' + out : out;
}

export function isAbsolute(path: string): boolean {
  assertPath(path);
  return path.length > 0 && path.charCodeAt(0) === SLASH;
}

export function join(...paths: string[]): string {
  if (paths.length === 0) return '.';
  let joined: string | undefined;
  for (const arg of paths) {
    assertPath(arg);
    if (arg.length > 0) joined = joined === undefined ? arg : joined + '/' + arg;
  }
  return joined === undefined ? '.' : normalize(joined);
}

/** Index of the first character after the leading slashes, starting at 1. */
function afterLeadingSlashes(p: string): number {
  let i = 1;
  while (i < p.length && p.charCodeAt(i) === SLASH) i++;
  return i;
}

export function relative(from: string, to: string): string {
  assertPath(from);
  assertPath(to);
  if (from === to) return '';
  from = resolve(from);
  to = resolve(to);
  if (from === to) return '';

  const fromStart = afterLeadingSlashes(from);
  const fromEnd = from.length;
  const fromLen = fromEnd - fromStart;
  let toStart = afterLeadingSlashes(to);
  const toLen = to.length - toStart;

  const length = Math.min(fromLen, toLen);
  let lastCommonSep = -1;
  let i = 0;
  for (; i <= length; ++i) {
    if (i === length) {
      if (toLen > length) {
        if (to.charCodeAt(toStart + i) === SLASH) return to.slice(toStart + i + 1); // from is a base of to
        if (i === 0) return to.slice(toStart + i); // from is the root
      } else if (fromLen > length) {
        if (from.charCodeAt(fromStart + i) === SLASH) lastCommonSep = i; // to is a base of from
        else if (i === 0) lastCommonSep = 0; // to is the root
      }
      break;
    }
    const fromCode = from.charCodeAt(fromStart + i);
    if (fromCode !== to.charCodeAt(toStart + i)) break;
    if (fromCode === SLASH) lastCommonSep = i;
  }

  let out = '';
  for (i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i) {
    if (i === fromEnd || from.charCodeAt(i) === SLASH) out += out.length === 0 ? '..' : '/..';
  }
  if (out.length > 0) return out + to.slice(toStart + lastCommonSep);
  toStart += lastCommonSep;
  if (to.charCodeAt(toStart) === SLASH) ++toStart;
  return to.slice(toStart);
}

export function _makeLong(path: string): string {
  return path;
}

export function dirname(path: string): string {
  assertPath(path);
  if (path.length === 0) return '.';
  const hasRoot = path.charCodeAt(0) === SLASH;
  let end = -1;
  let matchedSlash = true;
  for (let i = path.length - 1; i >= 1; --i) {
    if (path.charCodeAt(i) === SLASH) {
      if (!matchedSlash) {
        end = i;
        break;
      }
    } else {
      matchedSlash = false;
    }
  }
  if (end === -1) return hasRoot ? '/' : '.';
  if (hasRoot && end === 1) return '//';
  return path.slice(0, end);
}

export function basename(path: string, ext?: string): string {
  if (ext !== undefined && typeof ext !== 'string') throw new TypeError('"ext" argument must be a string');
  assertPath(path);

  let start = 0;
  let end = -1;
  let matchedSlash = true;

  if (ext !== undefined && ext.length > 0 && ext.length <= path.length) {
    if (ext.length === path.length && ext === path) return '';
    let extIdx = ext.length - 1;
    let firstNonSlashEnd = -1;
    for (let i = path.length - 1; i >= 0; --i) {
      const code = path.charCodeAt(i);
      if (code === SLASH) {
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
        continue;
      }
      if (firstNonSlashEnd === -1) {
        matchedSlash = false;
        firstNonSlashEnd = i + 1;
      }
      if (extIdx >= 0) {
        if (code === ext.charCodeAt(extIdx)) {
          if (--extIdx === -1) end = i; // the whole extension matched
        } else {
          extIdx = -1; // no match: keep the whole component
          end = firstNonSlashEnd;
        }
      }
    }
    if (start === end) end = firstNonSlashEnd;
    else if (end === -1) end = path.length;
    return path.slice(start, end);
  }

  for (let i = path.length - 1; i >= 0; --i) {
    if (path.charCodeAt(i) === SLASH) {
      if (!matchedSlash) {
        start = i + 1;
        break;
      }
    } else if (end === -1) {
      matchedSlash = false;
      end = i + 1;
    }
  }
  return end === -1 ? '' : path.slice(start, end);
}

/**
 * Scans the last path component from the right. Shared by extname and parse.
 * preDotState: 0 = nothing before the first dot, 1 = only dots, -1 = other characters.
 */
function scanLastComponent(path: string, stop: number) {
  let startDot = -1;
  let startPart = 0;
  let end = -1;
  let matchedSlash = true;
  let preDotState = 0;
  for (let i = path.length - 1; i >= stop; --i) {
    const code = path.charCodeAt(i);
    if (code === SLASH) {
      if (!matchedSlash) {
        startPart = i + 1;
        break;
      }
      continue;
    }
    if (end === -1) {
      matchedSlash = false;
      end = i + 1;
    }
    if (code === DOT) {
      if (startDot === -1) startDot = i;
      else if (preDotState !== 1) preDotState = 1;
    } else if (startDot !== -1) {
      preDotState = -1;
    }
  }
  const noExtension =
    startDot === -1 ||
    end === -1 ||
    preDotState === 0 || // a non-dot character right before the dot
    (preDotState === 1 && startDot === end - 1 && startDot === startPart + 1); // the component is exactly ".."
  return { startDot, startPart, end, noExtension };
}

export function extname(path: string): string {
  assertPath(path);
  const { startDot, end, noExtension } = scanLastComponent(path, 0);
  return noExtension ? '' : path.slice(startDot, end);
}

function formatWith(sep: string, pathObject: FormatInputPathObject): string {
  const dir = pathObject.dir || pathObject.root;
  const base = pathObject.base || (pathObject.name || '') + (pathObject.ext || '');
  if (!dir) return base;
  if (dir === pathObject.root) return dir + base;
  return dir + sep + base;
}

export function format(pathObject: FormatInputPathObject): string {
  if (pathObject === null || typeof pathObject !== 'object') {
    throw new TypeError(
      'The "pathObject" argument must be of type Object. Received type ' + typeof pathObject,
    );
  }
  return formatWith('/', pathObject);
}

export function parse(path: string): ParsedPath {
  assertPath(path);
  const ret: ParsedPath = { root: '', dir: '', base: '', ext: '', name: '' };
  if (path.length === 0) return ret;
  const absolute = path.charCodeAt(0) === SLASH;
  if (absolute) ret.root = '/';
  const { startDot, startPart, end, noExtension } = scanLastComponent(path, absolute ? 1 : 0);
  const from = startPart === 0 && absolute ? 1 : startPart;

  if (noExtension) {
    if (end !== -1) ret.base = ret.name = path.slice(from, end);
  } else {
    ret.name = path.slice(from, startDot);
    ret.base = path.slice(from, end);
    ret.ext = path.slice(startDot, end);
  }

  if (startPart > 0) ret.dir = path.slice(0, startPart - 1);
  else if (absolute) ret.dir = '/';
  return ret;
}

export const sep = '/';
export const delimiter = ':';
export const win32 = null;

export interface PathModule {
  resolve: typeof resolve;
  normalize: typeof normalize;
  isAbsolute: typeof isAbsolute;
  join: typeof join;
  relative: typeof relative;
  _makeLong: typeof _makeLong;
  dirname: typeof dirname;
  basename: typeof basename;
  extname: typeof extname;
  format: typeof format;
  parse: typeof parse;
  sep: '/';
  delimiter: ':';
  win32: null;
  posix: PathModule;
}

const posixModule = {
  resolve,
  normalize,
  isAbsolute,
  join,
  relative,
  _makeLong,
  dirname,
  basename,
  extname,
  format,
  parse,
  sep,
  delimiter,
  win32,
  posix: null as unknown as PathModule,
} as PathModule;
posixModule.posix = posixModule;

export const posix: PathModule = posixModule;
export default posixModule;
