"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ossuary/path-browserify/revived/src/index.ts
var index_exports = {};
__export(index_exports, {
  _makeLong: () => _makeLong,
  basename: () => basename,
  default: () => index_default,
  delimiter: () => delimiter,
  dirname: () => dirname,
  extname: () => extname,
  format: () => format,
  isAbsolute: () => isAbsolute,
  join: () => join,
  normalize: () => normalize,
  parse: () => parse,
  posix: () => posix,
  relative: () => relative,
  resolve: () => resolve,
  sep: () => sep,
  win32: () => win32
});
module.exports = __toCommonJS(index_exports);
var SLASH = 47;
var DOT = 46;
function assertPath(path) {
  if (typeof path !== "string") {
    let shown;
    try {
      shown = String(JSON.stringify(path));
    } catch {
      shown = typeof path;
    }
    throw new TypeError("Path must be a string. Received " + shown);
  }
}
function currentDir() {
  const proc = globalThis.process;
  return proc && typeof proc.cwd === "function" ? proc.cwd() : "/";
}
function normalizeSegments(path, allowAboveRoot) {
  let res = "";
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
    } else if (dots === 2) {
      const endsWithDotDot = res.length >= 2 && lastSegmentLength === 2 && res.charCodeAt(res.length - 1) === DOT && res.charCodeAt(res.length - 2) === DOT;
      let popped = false;
      if (!endsWithDotDot) {
        if (res.length > 2) {
          const lastSlashIndex = res.lastIndexOf("/");
          if (lastSlashIndex !== res.length - 1) {
            if (lastSlashIndex === -1) {
              res = "";
              lastSegmentLength = 0;
            } else {
              res = res.slice(0, lastSlashIndex);
              lastSegmentLength = res.length - 1 - res.lastIndexOf("/");
            }
            popped = true;
          }
        } else if (res.length === 2 || res.length === 1) {
          res = "";
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
        res = res.length > 0 ? res + "/.." : "..";
        lastSegmentLength = 2;
      }
    } else {
      const seg = path.slice(lastSlash + 1, i);
      res = res.length > 0 ? res + "/" + seg : seg;
      lastSegmentLength = i - lastSlash - 1;
    }
    lastSlash = i;
    dots = 0;
  }
  return res;
}
function resolve(...paths) {
  let resolved = "";
  let absolute = false;
  for (let i = paths.length - 1; i >= -1 && !absolute; i--) {
    const path = i >= 0 ? paths[i] : currentDir();
    assertPath(path);
    if (path.length === 0) continue;
    resolved = path + "/" + resolved;
    absolute = path.charCodeAt(0) === SLASH;
  }
  resolved = normalizeSegments(resolved, !absolute);
  if (absolute) return resolved.length > 0 ? "/" + resolved : "/";
  return resolved.length > 0 ? resolved : ".";
}
function normalize(path) {
  assertPath(path);
  if (path.length === 0) return ".";
  const absolute = path.charCodeAt(0) === SLASH;
  const trailingSeparator = path.charCodeAt(path.length - 1) === SLASH;
  let out = normalizeSegments(path, !absolute);
  if (out.length === 0 && !absolute) out = ".";
  if (out.length > 0 && trailingSeparator) out += "/";
  return absolute ? "/" + out : out;
}
function isAbsolute(path) {
  assertPath(path);
  return path.length > 0 && path.charCodeAt(0) === SLASH;
}
function join(...paths) {
  if (paths.length === 0) return ".";
  let joined;
  for (const arg of paths) {
    assertPath(arg);
    if (arg.length > 0) joined = joined === void 0 ? arg : joined + "/" + arg;
  }
  return joined === void 0 ? "." : normalize(joined);
}
function afterLeadingSlashes(p) {
  let i = 1;
  while (i < p.length && p.charCodeAt(i) === SLASH) i++;
  return i;
}
function relative(from, to) {
  assertPath(from);
  assertPath(to);
  if (from === to) return "";
  from = resolve(from);
  to = resolve(to);
  if (from === to) return "";
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
        if (to.charCodeAt(toStart + i) === SLASH) return to.slice(toStart + i + 1);
        if (i === 0) return to.slice(toStart + i);
      } else if (fromLen > length) {
        if (from.charCodeAt(fromStart + i) === SLASH) lastCommonSep = i;
        else if (i === 0) lastCommonSep = 0;
      }
      break;
    }
    const fromCode = from.charCodeAt(fromStart + i);
    if (fromCode !== to.charCodeAt(toStart + i)) break;
    if (fromCode === SLASH) lastCommonSep = i;
  }
  let out = "";
  for (i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i) {
    if (i === fromEnd || from.charCodeAt(i) === SLASH) out += out.length === 0 ? ".." : "/..";
  }
  if (out.length > 0) return out + to.slice(toStart + lastCommonSep);
  toStart += lastCommonSep;
  if (to.charCodeAt(toStart) === SLASH) ++toStart;
  return to.slice(toStart);
}
function _makeLong(path) {
  return path;
}
function dirname(path) {
  assertPath(path);
  if (path.length === 0) return ".";
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
  if (end === -1) return hasRoot ? "/" : ".";
  if (hasRoot && end === 1) return "//";
  return path.slice(0, end);
}
function basename(path, ext) {
  if (ext !== void 0 && typeof ext !== "string") throw new TypeError('"ext" argument must be a string');
  assertPath(path);
  let start = 0;
  let end = -1;
  let matchedSlash = true;
  if (ext !== void 0 && ext.length > 0 && ext.length <= path.length) {
    if (ext.length === path.length && ext === path) return "";
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
          if (--extIdx === -1) end = i;
        } else {
          extIdx = -1;
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
  return end === -1 ? "" : path.slice(start, end);
}
function scanLastComponent(path, stop) {
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
  const noExtension = startDot === -1 || end === -1 || preDotState === 0 || // a non-dot character right before the dot
  preDotState === 1 && startDot === end - 1 && startDot === startPart + 1;
  return { startDot, startPart, end, noExtension };
}
function extname(path) {
  assertPath(path);
  const { startDot, end, noExtension } = scanLastComponent(path, 0);
  return noExtension ? "" : path.slice(startDot, end);
}
function formatWith(sep2, pathObject) {
  const dir = pathObject.dir || pathObject.root;
  const base = pathObject.base || (pathObject.name || "") + (pathObject.ext || "");
  if (!dir) return base;
  if (dir === pathObject.root) return dir + base;
  return dir + sep2 + base;
}
function format(pathObject) {
  if (pathObject === null || typeof pathObject !== "object") {
    throw new TypeError(
      'The "pathObject" argument must be of type Object. Received type ' + typeof pathObject
    );
  }
  return formatWith("/", pathObject);
}
function parse(path) {
  assertPath(path);
  const ret = { root: "", dir: "", base: "", ext: "", name: "" };
  if (path.length === 0) return ret;
  const absolute = path.charCodeAt(0) === SLASH;
  if (absolute) ret.root = "/";
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
  else if (absolute) ret.dir = "/";
  return ret;
}
var sep = "/";
var delimiter = ":";
var win32 = null;
var posixModule = {
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
  posix: null
};
posixModule.posix = posixModule;
var posix = posixModule;
var index_default = posixModule;
module.exports = module.exports.default;
