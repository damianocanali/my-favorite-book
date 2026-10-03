// Seat additions on invoice-billed school plans (Stage 4 review N3).
//
// api/school/plan.js sends a stand-alone invoice (net 30) for the added
// seats and records it in school_seat_add_invoices; the seats are NOT
// granted then. This module grants them when Stripe says that invoice is
// paid (invoice.paid, metadata.type = 'school_plan_seats'), drops the add
// when it is voided or marked uncollectible, and tells the owner about adds
// past their due date (nightly).
import { subscriptionItem, setQuantity } from './billingApi.js'
import { refundInvoice } from './stripe.js'
import { sendOwnerAlert } from '../notify/ownerAlert.js'

export const SEAT_ADD_TYPE = 'school_plan_seats'
export const SEAT_ADD_EVENTS = ['invoice.paid', 'invoice.voided', 'invoice.marked_uncollectible']
const enc = encodeURIComponent

export const isSeatAddInvoice = (event) =>
  SEAT_ADD_EVENTS.includes(event?.type) && event.data?.object?.metadata?.type === SEAT_ADD_TYPE

async function one(sb, path) {
  const r = await sb(path)
  if (!r.ok) throw new Error(`read ${r.status}`)
  const rows = await r.json()
  return Array.isArray(rows) ? rows[0] ?? null : null
}

/// Throws on a database failure (the caller releases the ledger claim and
/// answers 500 so Stripe retries). Every step is retry-safe (review R4):
///   1. grant: conditional on seats = seats_from, and stamps the plan with
///      last_seat_add_invoice = this invoice — so a retry recognises its
///      own grant (seats = seats_to AND the stamp) instead of calling it a
///      conflict;
///   2. the record → 'paid';
///   3. Stripe's quantity → seats_to (idempotency key per invoice), then
///      quantity_raised_at; a retry redoes only what is missing.
/// A 'void' record that gets PAID after all (an uncollectible invoice paid
/// late, review R2): granted if the plan still has seats_from, otherwise
/// the payment is refunded and the owner told — never kept silently.
export async function onSeatAddInvoice(sb, stripe, event) {
  const inv = event.data.object
  const row = await one(sb, `/rest/v1/school_seat_add_invoices?invoice_id=eq.${enc(inv.id)}&select=invoice_id,plan_id,seats_from,seats_to,status,quantity_raised_at`)
  if (!row) {
    await sendOwnerAlert({ subject: 'Untracked seat-add invoice', lines: [`Invoice ${inv.id} (${event.type}) is a school seat add we have no record of. Check it in Stripe.`] }).catch(() => {})
    return
  }
  const now = new Date().toISOString()
  const setRow = async (patch, fromStatus) => {
    const r = await sb(`/rest/v1/school_seat_add_invoices?invoice_id=eq.${enc(inv.id)}${fromStatus ? `&status=eq.${fromStatus}` : ''}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch),
    })
    if (!r.ok) throw new Error(`record ${r.status}`)
  }

  if (event.type !== 'invoice.paid') {
    if (row.status !== 'pending') return // already decided: a replay
    await setRow({ status: 'void', decided_at: now }, 'pending')
    await sendOwnerAlert({ subject: 'Seat-add invoice not paid', lines: [`School plan ${row.plan_id}: the invoice for ${row.seats_from} → ${row.seats_to} seats was ${event.type === 'invoice.voided' ? 'voided' : 'marked uncollectible'}. The seats were not granted.`] }).catch(() => {})
    return
  }
  if (row.status === 'refunded') return
  if (row.status === 'paid' && row.quantity_raised_at) return // fully done: a replay

  let plan = null
  if (row.status !== 'paid') {
    const upd = await sb(`/rest/v1/school_plans?id=eq.${row.plan_id}&seats=eq.${row.seats_from}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ seats: row.seats_to, pending_seats: null, last_seat_add_invoice: inv.id, updated_at: now }),
    })
    if (!upd.ok) throw new Error(`grant ${upd.status}`)
    ;[plan] = await upd.json().catch(() => [])
    if (!plan) {
      plan = await one(sb, `/rest/v1/school_plans?id=eq.${row.plan_id}&select=id,seats,stripe_subscription_id,last_seat_add_invoice`)
      const ownGrant = plan && plan.seats === row.seats_to && plan.last_seat_add_invoice === inv.id
      if (!ownGrant) {
        // The seats moved on: this payment can't buy what it was for.
        const refunded = await refundInvoice(stripe, inv.id, `seat-add-refund-${inv.id}`)
        await setRow({ status: 'refunded', decided_at: now })
        await sendOwnerAlert({ subject: 'Seat-add payment refunded', lines: [`School plan ${row.plan_id}: invoice ${inv.id} (${row.seats_from} → ${row.seats_to}) was paid${row.status === 'void' ? ' after being voided/uncollectible' : ''}, but the plan no longer had ${row.seats_from} seats. Refunded: ${refunded ? 'yes' : 'NO — refund it in Stripe'}.`] }).catch(() => {})
        return
      }
    }
    await setRow({ status: 'paid', decided_at: now })
  } else {
    plan = await one(sb, `/rest/v1/school_plans?id=eq.${row.plan_id}&select=id,seats,stripe_subscription_id`)
  }

  // Stripe's quantity follows, without proration (the seats are paid).
  if (!plan?.stripe_subscription_id) {
    await sendOwnerAlert({ subject: 'Stripe quantity not raised', lines: [`School plan ${row.plan_id} paid for ${row.seats_to} seats (invoice ${inv.id}) but has no subscription; set the quantity by hand.`] }).catch(() => {})
    return
  }
  const item = plan?.stripe_subscription_id ? await subscriptionItem(stripe, plan.stripe_subscription_id) : null
  const q = item ? await setQuantity(stripe, plan.stripe_subscription_id, item.itemId, row.seats_to, `seat-add-qty-${inv.id}`) : { ok: false }
  if (q.ok) await setRow({ quantity_raised_at: now })
  else {
    // Thrown, so Stripe retries the event; the next try only redoes this.
    throw new Error('stripe quantity not raised')
  }
}

/// Nightly: seat adds past their due date, reported once to the owner.
export async function alertOverdueSeatAdds(sb, { now = new Date(), dryRun = true } = {}) {
  const at = enc(new Date(now).toISOString())
  const r = await sb(`/rest/v1/school_seat_add_invoices?status=eq.pending&overdue_alerted_at=is.null&due_at=lt.${at}&select=invoice_id,plan_id,seats_from,seats_to,due_at&limit=200`)
  if (!r.ok) return { overdue: 0, failed: r.status === 404 ? 0 : 1 }
  const rows = await r.json()
  if (!rows.length || dryRun) return { overdue: rows.length, failed: 0 }
  await sendOwnerAlert({
    subject: 'Seat-add invoices overdue',
    lines: rows.map((x) => `School plan ${x.plan_id}: invoice ${x.invoice_id} (${x.seats_from} → ${x.seats_to}) was due ${x.due_at}. Seats not granted.`),
  })
  for (const x of rows) {
    await sb(`/rest/v1/school_seat_add_invoices?invoice_id=eq.${enc(x.invoice_id)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ overdue_alerted_at: new Date(now).toISOString() }),
    })
  }
  return { overdue: rows.length, failed: 0 }
}
