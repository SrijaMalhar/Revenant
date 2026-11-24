/**
 * path-browserify, revived.
 *
 * A zero-dependency TypeScript reimplementation of path-browserify 1.0.1,
 * which itself ports the POSIX half of Node's `path` module (Node 8.11.1).
 * It aims to behave exactly like that original on every input, including
 * its quirks, so it can replace it without changing any caller's results.
 */
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
export declare function resolve(...paths: string[]): string;
export declare function normalize(path: string): string;
export declare function isAbsolute(path: string): boolean;
export declare function join(...paths: string[]): string;
export declare function relative(from: string, to: string): string;
export declare function _makeLong(path: string): string;
export declare function dirname(path: string): string;
export declare function basename(path: string, ext?: string): string;
export declare function extname(path: string): string;
export declare function format(pathObject: FormatInputPathObject): string;
export declare function parse(path: string): ParsedPath;
export declare const sep = "/";
export declare const delimiter = ":";
export declare const win32: null;
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
declare const posixModule: PathModule;
export declare const posix: PathModule;
export default posixModule;
