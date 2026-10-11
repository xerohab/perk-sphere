import test from 'node:test';import assert from 'node:assert/strict';
import {normalizePartnerDomain,partnerProvisionRequest} from '../base44/shared/partnerProvisioning.ts';
test('partner provisioning converts pasted root HTTPS URLs to hostnames',()=>{
 assert.equal(normalizePartnerDomain('https://thefrontrow.net/'),'thefrontrow.net');assert.equal(normalizePartnerDomain(' DKOSportsEntertainment.com '),'dkosportsentertainment.com');
 const p=partnerProvisionRequest({id:'new',name:'Partner',verified_domains:['https://thefrontrow.net/']});assert.deepEqual(p.verified_domains,['thefrontrow.net']);
});
test('partner provisioning rejects credentials, paths, insecure URLs and invalid hosts',()=>{
 for(const value of ['http://example.com','https://user:password@example.com','https://example.com/path','https://example.com/?a=1','https://example.com/#x','https://example.com:444','127.0.0.1','bad..example.com','-bad.example.com','localhost'])assert.throws(()=>normalizePartnerDomain(value));
});
