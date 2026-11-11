import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {secrets} from 'base44:runtime';
import {linuxTrustedPost} from '../../shared/linuxClient.ts';
import {createGiftVoucherMemberHandler} from '../../shared/giftVoucherMemberHandler.ts';
const handler=createGiftVoucherMemberHandler({getClient:createClientFromRequest,getSecret:name=>secrets.get(name),post:(path,body)=>linuxTrustedPost(path,body,undefined,true)});
export default handler;if(typeof Deno!=='undefined')Deno.serve(handler);
