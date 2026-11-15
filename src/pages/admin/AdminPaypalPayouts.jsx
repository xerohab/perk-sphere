import React from 'react';
import {Link} from 'react-router-dom';
import PaypalPayoutPanel from '@/components/perk/PaypalPayoutPanel';
import PageHeader from '@/components/perk/PageHeader';
export default function AdminPaypalPayouts(){return <div className="space-y-6"><PageHeader title="PayPal payouts" description="Review withdrawal requests and reconcile manual payments."/><p className="text-sm">Configure the Points-to-GBP rate and approved funding budget in <Link className="underline" to="/admin/launch-checks">Launch checks</Link> before opening cash conversion. No rate or funding amount is supplied automatically.</p><PaypalPayoutPanel admin/></div>;}
