// Owner feedback round 5: lines that tell an ordinary teacher "ask your
// school" have a `_billing_admin` twin (the pre-round-5 wording, pointing
// at Plan & billing) for billing admins and the owner, who see the full
// section on the same page. Pure; callers pass useIsBillingAdmin().
export const forBillingRole = (key, billingAdmin) => (billingAdmin ? `${key}_billing_admin` : key)
