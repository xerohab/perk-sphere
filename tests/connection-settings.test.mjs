import test from 'node:test';
import assert from 'node:assert/strict';
import {loadConnectionSettings,connectionDisplayState} from '../src/lib/connection-settings.js';
const now=Date.parse('2026-10-30T12:00:00Z');
const row={id:'connection',user_id:'MEMBER',service:'x',status:'connected',token_expiry:'2026-10-30T13:00:00Z'};
const config={google:{configured:true},youtube:{configured:true},x:{configured:true}};
function client(){return {entities:{ConnectedService:{filter:async query=>{assert.deepEqual(query,{user_id:'MEMBER'});return [row];}}},functions:{invoke:async()=>({data:{ok:true,providers:config}})}};}
test('failed provider availability is distinct from an unconfigured provider and preserves linked accounts',async()=>{
 const c=client();c.functions.invoke=async()=>{throw Error('offline');};const data=await loadConnectionSettings(c,'MEMBER');
 assert.equal(data.configurationUnavailable,true);assert.equal(data.connectionsUnavailable,false);assert.equal(data.connections.length,1);assert.deepEqual(data.config,{});
});
test('malformed availability status cannot be mistaken for a successful unconfigured result',async()=>{
 const c=client();c.functions.invoke=async()=>({data:{providers:{}}});assert.equal((await loadConnectionSettings(c,'MEMBER')).configurationUnavailable,true);
 c.functions.invoke=async()=>({data:{ok:true,providers:{...config,x:{configured:false}}}});const data=await loadConnectionSettings(c,'MEMBER');assert.equal(data.configurationUnavailable,false);assert.equal(data.config.x.configured,false);
});
test('connection load failure does not discard a valid provider status',async()=>{
 const c=client();c.entities.ConnectedService.filter=async()=>{throw Error('offline');};const data=await loadConnectionSettings(c,'MEMBER');
 assert.equal(data.connectionsUnavailable,true);assert.equal(data.configurationUnavailable,false);assert.equal(data.config.x.configured,true);
});
test('expired, revoked, ambiguous and other-member connections never offer verified linking claims',()=>{
 assert.equal(connectionDisplayState([row],'x','MEMBER',now).isConnected,true);
 for(const candidate of [{...row,token_expiry:new Date(now).toISOString()},{...row,token_expiry:'bad'},{...row,revoked_at:'2026-10-30'},{...row,user_id:'OTHER'}]){
  assert.equal(connectionDisplayState([candidate],'x','MEMBER',now).isConnected,false);
 }
 const expired=connectionDisplayState([{...row,token_expiry:'2020-01-01'}],'x','MEMBER',now);assert.equal(expired.needsReconnect,true);assert.equal(expired.canDisconnect,true);
 const ambiguous=connectionDisplayState([row,{...row,id:'duplicate'}],'x','MEMBER',now);assert.equal(ambiguous.isConnected,false);assert.equal(ambiguous.needsReconnect,true);assert.equal(ambiguous.canDisconnect,true);
});
