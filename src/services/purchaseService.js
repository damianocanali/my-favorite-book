// Handles In-App Purchase on iOS via RevenueCat.
// On web, falls back to Stripe checkout (existing flow).

import { Capacitor } from '@capacitor/core'

const IS_NATIVE = Capacitor.isNativePlatform()

// RevenueCat product IDs — must match App Store Connect exactly
export const IAP_PRODUCTS = {
  family_monthly:  'com.myfavoritebook.app.family.monthly.v2',
  family_annual:   'com.myfavoritebook.app.family.annual',
  teacher_monthly: 'com.myfavoritebook.app.teacher.monthly',
  teacher_annual:  'com.myfavoritebook.app.teacher.annual',
}

// Consumable coin packs. Apple requires in-app currency purchased on iOS to
// go through StoreKit (App Store Review Guideline 3.1.1), so on native we
// route these through RevenueCat. The web build continues to use Stripe.
// Product IDs must be created as Consumable IAPs in App Store Connect and
// mapped in RevenueCat. Expected retail prices: small=$0.99, medium=$2.99,
// large=$4.99 — Apple set them, not our server.
export const COIN_PACK_IAP_PRODUCTS = {
  small:  'com.myfavoritebook.app.coins.small',
  medium: 'com.myfavoritebook.app.coins.medium',
  large:  'com.myfavoritebook.app.coins.large',
}

// The Capacitor Purchases plugin is a proxy that forwards every property
// access to native. If we ever return it from an async function, the
// promise-resolution machinery probes the returned value for .then, which
// routes through the proxy to native and blows up with "Purchases.then() is
// not implemented on ios". So we keep the plugin in a module-local and
// always call its methods inline — never hand the proxy back to callers.
let _Purchases = null

// A single promise that resolves once configure() has run successfully.
// Every IAP method awaits this before calling native — prevents races
// where a user taps "Upgrade" before startup init has finished, which
// manifests as "Purchases must be configured before calling this function".
let _configured = null

async function ensureRC() {
  if (!IS_NATIVE) return false
  if (_Purchases) return true
  const mod = await import('@revenuecat/purchases-capacitor')
  _Purchases = mod.Purchases
  return true
}

async function configureOnce(userId) {
  const ok = await ensureRC()
  if (!ok) throw new Error('IAP not available on this platform')
  const apiKey = import.meta.env.VITE_REVENUECAT_IOS_KEY
  if (!apiKey) {
    throw new Error('VITE_REVENUECAT_IOS_KEY is not set in the build — rebuild after adding it to .env.local')
  }
  await _Purchases.configure({ apiKey })
  if (userId) {
    try { await _Purchases.logIn({ appUserID: userId }) } catch (e) { console.warn('[IAP] logIn failed', e) }
  }
}

export async function initRevenueCat(userId) {
  if (!IS_NATIVE) return
  if (_configured) return _configured
  _configured = configureOnce(userId).catch((e) => {
    console.error('[IAP] initRevenueCat error', e)
    _configured = null // let a later call retry
    throw e
  })
  return _configured
}

// Called before any getOfferings / purchase call. If init hasn't fired
// yet (shouldn't happen, but covers races), kicks it off without a
// userId — we'll rely on anonymous IAP until auth fills in.
async function ensureConfigured() {
  if (!IS_NATIVE) throw new Error('IAP not available on this platform')
  if (!_configured) await initRevenueCat(null)
  else await _configured
}

export async function getOfferings() {
  try {
    await ensureConfigured()
    const { current } = await _Purchases.getOfferings()
    return current
  } catch (e) {
    console.error('[IAP] getOfferings error', e)
    return null
  }
}

export async function purchasePackage(planName, billing) {
  await ensureConfigured()

  const productId = IAP_PRODUCTS[`${planName}_${billing}`]
  if (!productId) throw new Error('Unknown product')

  const offering = await getOfferings()
  if (!offering) throw new Error('No offerings available — configure an offering with these products in RevenueCat')

  const pkg = offering.availablePackages.find(
    (p) => p.product.identifier === productId
  )
  if (!pkg) throw new Error(`Package not found: ${productId}. Make sure this product is attached to the current RevenueCat offering.`)

  const { customerInfo } = await _Purchases.purchasePackage({ aPackage: pkg })
  return customerInfo
}

// Purchase a consumable coin pack via StoreKit. Returns true when the
// transaction succeeds; the RevenueCat webhook then credits coins
// server-side via add_coins. The caller should refresh the balance
// afterwards rather than trust any amount from the client.
export async function purchaseCoinPack(packKey) {
  await ensureConfigured()

  const productId = COIN_PACK_IAP_PRODUCTS[packKey]
  if (!productId) throw new Error('Unknown coin pack')

  const offering = await getOfferings()
  const pkg = offering?.availablePackages?.find(
    (p) => p.product.identifier === productId
  )

  if (pkg) {
    const { customerInfo } = await _Purchases.purchasePackage({ aPackage: pkg })
    return { ok: true, customerInfo }
  }

  const { products } = await _Purchases.getProducts({ productIdentifiers: [productId] })
  const product = products?.[0]
  if (!product) throw new Error(`Product not found: ${productId}`)
  const { customerInfo } = await _Purchases.purchaseStoreProduct({ product })
  return { ok: true, customerInfo }
}

export async function restorePurchases() {
  await ensureConfigured()
  const { customerInfo } = await _Purchases.restorePurchases()
  return customerInfo
}

export async function getCustomerInfo() {
  try {
    await ensureConfigured()
    const { customerInfo } = await _Purchases.getCustomerInfo()
    return customerInfo
  } catch (e) {
    console.error('[IAP] getCustomerInfo error', e)
    return null
  }
}

// Map RevenueCat entitlement to our plan key
export function planFromEntitlements(customerInfo) {
  if (!customerInfo?.entitlements?.active) return 'free'
  const active = customerInfo.entitlements.active
  if (active['teacher']) return 'teacher'
  if (active['family']) return 'family'
  return 'free'
}

export { IS_NATIVE }
