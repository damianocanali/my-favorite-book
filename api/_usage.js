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

// Together AI — per image. FLUX.2-dev is priced per image; kontext-pro per
// megapixel ($0.04/MP), which at our 512x512 and 768x512 sizes is ~1-1.6 cents.
// Source: Together's /v1/models pricing, checked 2026-09-26. Update when changed.
// schnell and kontext-dev are kept only so historical usage rows still price.
const TOGETHER_IMAGE_PRICES = {
  'black-forest-labs/FLUX.2-dev':          1.5,  // ~$0.015/image
  'black-forest-labs/FLUX.1-kontext-pro':  1.6,  // ~$0.04/MP x 0.39MP (768x512)
  'black-forest-labs/FLUX.1-schnell':      0.5,  // retired from serverless 2026-09
  'black-forest-labs/FLUX.1-kontext-dev':  3,    // retired from serverless 2026-09
  'black-forest-labs/FLUX.1-dev':          2.5,
  'black-forest-labs/FLUX.1-pro':          5,
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
