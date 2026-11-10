import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {secrets} from 'base44:runtime';
import {verifyTrustedRequest} from '../../shared/hmac.ts';
import {createGiftCheckoutRecoveryAuthorityHandler} from '../../shared/giftCheckoutRecoveryAuthorityHandler.ts';
const handler=createGiftCheckoutRecoveryAuthorityHandler({getClient:createClientFromRequest,getSecret:name=>secrets.get(name),verify:verifyTrustedRequest});
export default handler;if(typeof Deno!=='undefined')Deno.serve(handler);
