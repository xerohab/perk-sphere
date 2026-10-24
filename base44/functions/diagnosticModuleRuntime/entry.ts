import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {secrets} from 'base44:runtime';
Deno.serve(()=>Response.json({ok:typeof createClientFromRequest==='function'&&typeof secrets.get==='function',probe:'modules-v1'}));
