// Approval acknowledges a request; it never implies a ledger credit.
export function rewardReviewStatus(value){
 if(value==='pending_review')return 'pending';
 if(value==='acknowledged')return 'approved';
 if(value==='rejected')return 'denied';
 return ['pending','approved','denied','ledger_confirmed'].includes(value)?value:'unknown';
}
