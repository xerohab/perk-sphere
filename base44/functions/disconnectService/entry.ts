import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { getProviderSecrets, decryptToken, revokeGoogleToken, revokeXToken, ALLOWED_PROVIDERS } from '../../shared/oauth.ts';

// Stop local use and remove credentials before making best-effort remote calls.
// Provider outages cannot leave a locally connected account or usable tokens.
async function perkSphereHandler(req) {
 const headers={'Cache-Control':'no-store'};
 if(req.method!=='POST')return Response.json({error:'method_not_allowed'},{status:405,headers});
 try {
  const base44=createClientFromRequest(req);
  const user=await base44.auth.me().catch(()=>null);
  if(!user?.id)return Response.json({error:'Unauthorized'},{status:401,headers});
  const body=await req.json().catch(()=>null);
  if(!body||Array.isArray(body)||Object.keys(body).join(',')!=='provider'||!ALLOWED_PROVIDERS.includes(body.provider))
   return Response.json({error:'Unsupported provider'},{status:400,headers});
  const provider=body.provider,admin=base44.asServiceRole,now=new Date().toISOString();
  const [creds,conns]=await Promise.all([
   admin.entities.ConnectedServiceCredential.filter({user_id:user.id,provider},'-created_date',1000),
   admin.entities.ConnectedService.filter({user_id:user.id,service:provider},'-created_date',1000)
  ]);
  if(creds.length>=1000||conns.length>=1000)throw Error('connection_cleanup_limit');
  for(const conn of conns)await admin.entities.ConnectedService.update(conn.id,{status:'disconnected',revoked_at:now});
  for(const cred of creds)await admin.entities.ConnectedServiceCredential.update(cred.id,{
   encrypted_access_token:'',access_token_iv:'',encrypted_refresh_token:'',refresh_token_iv:'',revoked_at:now
  });
  const encKey=secrets.get('OAUTH_TOKEN_ENCRYPTION_KEY'),providerCreds=getProviderSecrets(secrets,provider);
  if(encKey&&providerCreds)for(const cred of creds){
   try{
    const access=await decryptToken(cred.encrypted_access_token,cred.access_token_iv,encKey);
    const refresh=await decryptToken(cred.encrypted_refresh_token,cred.refresh_token_iv,encKey);
    const token=refresh||access;
    if(token){if(provider==='x')await revokeXToken(token,providerCreds.clientId,providerCreds.clientSecret);else await revokeGoogleToken(token);}
   }catch{/* Local credentials have already been removed. */}
  }
  return Response.json({ok:true},{headers});
 }catch{return Response.json({error:'disconnect_unavailable'},{status:503,headers});}
}
export default perkSphereHandler;
if (typeof Deno !== 'undefined') Deno.serve(perkSphereHandler);
