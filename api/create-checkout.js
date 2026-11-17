import { requireUser, getJsonBody } from '../lib/auth.js';
import { applyCors } from '../lib/cors.js';
import { whopConfig } from '../lib/plans.js';


export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed.' });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const { plan } = getJsonBody(req);
  if (!['starter', 'pro'].includes(plan)) {
    return res.status(400).json({ message: 'Choose a valid plan.' });
  }

  const whop = whopConfig();
  const origin = process.env.SITE_URL || `https://${req.headers.host}`;
  // No Whop plan (or key) yet: the plan's own placeholder page, so the flow still runs end to end.
  // It isn't tied to the account, so it can't unlock anything; real checkouts come once Whop is set up.
  if (!whop.apiKey || whop.isPlaceholder(plan)) {
    return res.status(200).json({ checkoutUrl: whop.planLink(plan), placeholder: true, sandbox: whop.sandbox });
  }

  const metadata = { user_id: user.id, email: user.email, plan };

  try {
    const response = await fetch(`${whop.apiBase}/checkout_configurations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${whop.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Whop's docs name the plan field both ways (plan_id, and variant_id in the newer API);
        // WHOP_CHECKOUT_PLAN_FIELD switches it if the sandbox wants the other.
        [process.env.WHOP_CHECKOUT_PLAN_FIELD || 'plan_id']: whop.planId(plan),
        metadata,
        redirect_url: `${origin}/pricing?checkout=done`,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Whop checkout failed:', data);
      return res.status(502).json({ message: 'Could not create checkout. Check the Whop plan and key settings.' });
    }

    const checkoutUrl = data.purchase_url?.startsWith('http')
      ? data.purchase_url
      : `${whop.checkoutHost}${data.purchase_url || `/checkout/${whop.planId(plan)}`}`;

    return res.status(200).json({ checkoutUrl, sandbox: whop.sandbox });
  } catch (error) {
    console.error('Create checkout failed:', error);
    return res.status(500).json({ message: 'Could not create checkout right now.' });
  }
}
