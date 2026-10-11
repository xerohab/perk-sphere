import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
let checked = 0, failed = false;
function walk(dir) {
 for (const item of readdirSync(dir, {withFileTypes:true})) {
  const path=join(dir,item.name);
  if(item.isDirectory()) { walk(path); continue; }
  if(path.endsWith('.ts')) {
   const source=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
   for(const error of source.parseDiagnostics) { failed=true; console.error(path+': '+ts.flattenDiagnosticMessageText(error.messageText,' ')); }
   checked++;
  } else if(path.endsWith('.jsonc')) {
   const parsed=ts.parseConfigFileTextToJson(path,readFileSync(path,'utf8'));
   if(parsed.error){failed=true;console.error(path+': invalid JSONC');}
   checked++;
  }
 }
}
walk('base44');console.log(`Parsed ${checked} backend source and resource files (syntax check only).`);
process.exitCode=failed?1:0;
