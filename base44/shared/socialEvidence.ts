import {secrets} from 'base44:runtime';
import {decryptToken,getYouTubeUserInfo,getXUserInfo,validateProviderIdentity} from './oauth.ts';
import {assertAccountEligible} from './rewardPolicy.ts';
function validPair(conns,creds,provider,userReference,now){
 if(conns.length!==1||creds.length!==1)throw Error('social_connection_unavailable');
 const connection=conns[0],credential=creds[0];
 if(connection.user_id!==userReference||connection.service!==provider||connection.status!=='connected'||connection.revoked_at||
    credential.user_id!==userReference||credential.provider!==provider||credential.connected_service_id!==connection.id||credential.revoked_at||
    !credential.encrypted_access_token||!credential.access_token_iv||credential.provider_user_id!==connection.provider_user_id||
    connection.external_account_id!==connection.provider_user_id||
    (credential.token_expiry!=null&&(!Number.isFinite(Date.parse(credential.token_expiry))||Date.parse(credential.token_expiry)<=now)))
  throw Error('social_connection_unavailable');
 return {connection,credential};
}
export async function socialLinkEvidence(admin,{provider,userReference},{getSecret=name=>secrets.get(name),clock=Date.now,identityLookup}={}){
 if(!['youtube','x'].includes(provider)||typeof userReference!=='string'||!/^[A-Za-z0-9_:@.-]{1,191}$/.test(userReference))throw Error('invalid_social_request');
 if(getSecret('PERKSPHERE_SOCIAL_LINK_SOURCE_ENABLED')!=='true'||getSecret('PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE')!=='true')throw Error('social_source_disabled');
 const load=async()=>{
  const [conns,creds]=await Promise.all([
   admin.entities.ConnectedService.filter({user_id:userReference,service:provider}),
   admin.entities.ConnectedServiceCredential.filter({user_id:userReference,provider})
  ]);return validPair(conns,creds,provider,userReference,clock());
 };
 const before=await load();
 const token=await decryptToken(before.credential.encrypted_access_token,before.credential.access_token_iv,getSecret('OAUTH_TOKEN_ENCRYPTION_KEY'));
 if(!token)throw Error('social_connection_unavailable');
 const identity=validateProviderIdentity(provider,await (identityLookup||(provider==='youtube'?getYouTubeUserInfo:getXUserInfo))(token));
 if(identity.provider_user_id!==before.connection.provider_user_id)throw Error('social_identity_mismatch');
 // Re-read after provider I/O so a completed disconnect/reconnect cannot use old evidence.
 const after=await load();
 for(const key of ['id','provider_user_id','encrypted_access_token','access_token_iv','token_expiry'])
  if(after.credential[key]!==before.credential[key])throw Error('social_connection_changed');
 if(after.connection.id!==before.connection.id)throw Error('social_connection_changed');
 const member=await admin.entities.User.get(userReference);
 if(member?.id!==userReference)throw Error('social_member_unavailable');
 const restrictions=await admin.entities.Restriction.filter({user_id:userReference});
 assertAccountEligible(member,restrictions,'earn rewards');
 return {proof_version:1,provider,user_reference:userReference,account_reference:identity.provider_user_id,
  connection_reference:after.connection.id,credential_reference:after.credential.id,verified_at:new Date(clock()).toISOString(),eligible:true};
}
