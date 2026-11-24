/**
 * type-check, revived.
 *
 * A zero-dependency TypeScript reimplementation of type-check 0.4.0 by
 * George Zahariev. The three prelude-ls helpers it used (any, all, isItNaN)
 * are inlined, so this one package replaces both type-check and prelude-ls.
 * It aims to behave exactly like the original on every input.
 */
export declare const VERSION = "0.4.0";
export type TypeNode = {
    type: string;
    structure?: undefined;
} | {
    type?: string;
    structure: 'array';
    of: TypeNode[];
} | {
    type?: string;
    structure: 'tuple';
    of: TypeNode[][];
} | {
    type?: string;
    structure: 'fields';
    of: Record<string, TypeNode[]>;
    subset: boolean;
};
export interface CustomType {
    typeOf?: string;
    validate: (value: any) => boolean;
}
export interface Options {
    customTypes?: Record<string, CustomType>;
}
export declare function parseType(input: string): TypeNode[];
export declare function parsedTypeCheck(parsedType: TypeNode[], input: unknown, options?: Options | null): boolean;
export declare function typeCheck(type: string, input: unknown, options?: Options | null): boolean;
declare const typeCheckModule: {
    VERSION: string;
    typeCheck: typeof typeCheck;
    parsedTypeCheck: typeof parsedTypeCheck;
    parseType: typeof parseType;
};
export default typeCheckModule;
