import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {secrets} from 'base44:runtime';
import {verifyTrustedRequest} from '../../shared/hmac.ts';
import {createGiftSourceAuthorityHandler} from '../../shared/giftSourceAuthorityHandler.ts';
const handler=createGiftSourceAuthorityHandler({getClient:createClientFromRequest,getSecret:name=>secrets.get(name),verify:verifyTrustedRequest});
export default handler;if(typeof Deno!=='undefined')Deno.serve(handler);
