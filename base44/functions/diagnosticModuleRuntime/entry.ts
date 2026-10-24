import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
Deno.serve(req=>{try{const client=createClientFromRequest(req);return Response.json({ok:!!client,probe:'sdk-constructor-v1'});}catch(error){return Response.json({ok:false,probe:'sdk-constructor-v1',kind:error.name,detail:String(error.message).slice(0,800)},{status:500});}});
