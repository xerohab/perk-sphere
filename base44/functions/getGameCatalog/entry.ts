import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {linuxTrustedPost} from '../../shared/linuxClient.ts';
import {assertAccountEligible} from '../../shared/rewardPolicy.ts';
import {NATIVE_GAME_IDS} from '../../shared/nativeGames.ts';
async function handler(req){
 const headers={'Cache-Control':'no-store'};
 if(req.method!=='POST')return Response.json({error:'method_not_allowed'},{status:405,headers});
 try{
  const base44=createClientFromRequest(req),user=await base44.auth.me().catch(()=>null);
  if(!user?.id)return Response.json({error:'unauthorized'},{status:401,headers});
  const body=await req.json().catch(()=>null);
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length)return Response.json({error:'invalid_request'},{status:400,headers});
  const restrictions=await base44.asServiceRole.entities.Restriction.filter({user_id:user.id});
  try{assertAccountEligible(user,restrictions,'view earning games');}catch{return Response.json({error:'account_restricted'},{status:403,headers});}
  const result=await linuxTrustedPost('/v1/perk-sphere/games/catalog',{actor:{role:'member',user_reference:user.id}});
  if(!result.ok||!Array.isArray(result.data)||result.data.length>NATIVE_GAME_IDS.length)throw Error('INVALID_CATALOG');
  const games=result.data.map(game=>{
   if(!game||!NATIVE_GAME_IDS.includes(game.game_reference)||game.enabled!==true||typeof game.title!=='string'||!game.title.trim()||game.title.length>100||!Number.isSafeInteger(game.required_seconds)||game.required_seconds<60||game.required_seconds>3600||![game.points,game.xp].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000)||game.points+game.xp<1)throw Error('INVALID_GAME_POLICY');
   return {game_reference:game.game_reference,title:game.title,required_seconds:game.required_seconds,points:game.points,xp:game.xp};
  });
  if(new Set(games.map(game=>game.game_reference)).size!==games.length)throw Error('INVALID_CATALOG');
  return Response.json({data:games},{headers});
 }catch{return Response.json({error:'game_catalog_unavailable'},{status:503,headers});}
}
export default handler;if(typeof Deno!=='undefined')Deno.serve(handler);
