import React from 'react';
import { Link, useParams } from 'react-router-dom';
import PageHeader from '@/components/perk/PageHeader';
import GiftVoucherReveal from '@/components/perk/GiftVoucherReveal';
import { giftVoucherRequest } from '../../../base44/shared/giftVoucherContract.ts';

export default function GiftVoucher() {
  const { intentUuid } = useParams();
  let valid = false;
  try {
    giftVoucherRequest({ intentUuid, requestReference: '00000000-0000-4000-8000-000000000000' });
    valid = true;
  } catch { /* Invalid links never mount the reveal component. */ }
  return <div className="mx-auto max-w-2xl space-y-6">
    <PageHeader title="Your gift voucher" description="Open your voucher securely when you are ready to use it." />
    {valid ? <GiftVoucherReveal key={intentUuid} intentUuid={intentUuid} /> :
      <p role="alert" className="rounded-xl border bg-card p-5">This voucher link is invalid. Return to Rewards or contact support.</p>}
    <Link to="/rewards" className="inline-block text-sm underline">Back to Rewards</Link>
  </div>;
}
