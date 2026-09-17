declare module "node:fs/promises" {
  export function mkdir(path:string, options?:{recursive?:boolean}):Promise<string|undefined>;
  export function readFile(path:string, encoding:"utf8"):Promise<string>;
  export function writeFile(path:string, data:string, options?:{encoding?:"utf8";flag?:string}):Promise<void>;
  export function rename(oldPath:string,newPath:string):Promise<void>;
  export function readdir(path:string):Promise<string[]>;
}
declare module "node:path" { export function join(...paths:string[]):string; }
