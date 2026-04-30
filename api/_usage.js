// Helper for logging paid-provider API calls into the `usage_log` table.
// All API endpoints that hit Anthropic or Together AI should call logUsage
// after a successful response so the owner cost dashboard has real data.
//
// Pricing is HARDCODED here; update when providers change rates. These are
// estimates intended for monitoring, not invoicing.

// Anthropic — per 1M tokens, USD cents (×100 from $/1M).
// Source: anthropic.com/pricing as of 2026-04. Update when changed.
const ANTHROPIC_PRICES = {
  'claude-haiku-4-5-20251001':   { input: 100, output: 500 },     // $1.00 / $5.00 per 1M
  'claude-sonnet-4-6':           { input: 300, output: 1500 },    // $3.00 / $15.00 per 1M
  'claude-opus-4-7':             { input: 1500, output: 7500 },   // $15.00 / $75.00 per 1M
}

// Together AI — per image (any FLUX schnell call is roughly the same).
// Source: together.ai/pricing as of 2026-04. Update when changed.
const TOGETHER_IMAGE_PRICES = {
  'black-forest-labs/FLUX.1-schnell': 0.5,  // ~$0.005/image = 0.5 cents
  'black-forest-labs/FLUX.1-dev':     2.5,  // ~$0.025/image = 2.5 cents (estimate)
  'black-forest-labs/FLUX.1-pro':     5,    // ~$0.05/image = 5 cents (estimate)
}

export function estimateAnthropicCostCents({ model, input_tokens = 0, output_tokens = 0 }) {
  const rates = ANTHROPIC_PRICES[model]
  if (!rates) return 0
  // tokens × cents-per-1M / 1_000_000, integer cents
  const cents = (input_tokens * rates.input + output_tokens * rates.output) / 1_000_000
  return Math.max(0, Math.round(cents))
}

export function estimateTogetherImageCostCents({ model, images = 1 }) {
  const perImage = TOGETHER_IMAGE_PRICES[model] ?? 0.5
  return Math.max(0, Math.round(perImage * images))
}

// Fire-and-forget write to usage_log. Never throws — observability must not
// break the request path. Safe to call from Edge runtime.
export async function logUsage({ service, feature, model, user_id = null, input_tokens = null, output_tokens = null, images = null, cost_cents = 0 }) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return

  try {
    await fetch(`${supabaseUrl}/rest/v1/usage_log`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        service, feature, model, user_id,
        input_tokens, output_tokens, images, cost_cents,
      }),
    })
  } catch {
    // Swallow — this is observability, not a critical path.
  }
}
