import test from 'node:test';
import assert from 'node:assert/strict';
import {rewardReviewStatus} from '../src/lib/reward-review-status.js';
test('acknowledged requests display approval without inventing a credit',()=>{
 assert.equal(rewardReviewStatus('acknowledged'),'approved');
 assert.equal(rewardReviewStatus('approved'),'approved');
 assert.notEqual(rewardReviewStatus('acknowledged'),'ledger_confirmed');
});
test('pending and rejected API statuses map accurately and unknown states stay unknown',()=>{
 assert.equal(rewardReviewStatus('pending_review'),'pending');
 assert.equal(rewardReviewStatus('rejected'),'denied');
 assert.equal(rewardReviewStatus('ledger_confirmed'),'ledger_confirmed');
 for(const value of [undefined,null,'unexpected'])assert.equal(rewardReviewStatus(value),'unknown');
});
