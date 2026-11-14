import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {secrets} from 'base44:runtime';
import {linuxTrustedPost} from '../../shared/linuxClient.ts';
import {createGiftMemberCheckoutHandler} from '../../shared/giftMemberCheckoutHandler.ts';
const handler=createGiftMemberCheckoutHandler({getClient:createClientFromRequest,getSecret:name=>secrets.get(name),post:(path,body)=>linuxTrustedPost(path,body,undefined,true)});
export default handler;if(typeof Deno!=='undefined')Deno.serve(handler);
