// Handles In-App Purchase on iOS via RevenueCat.
// On web, falls back to Stripe checkout (existing flow).

import { Capacitor } from '@capacitor/core'

const IS_NATIVE = Capacitor.isNativePlatform()

// RevenueCat product IDs — must match App Store Connect exactly
export const IAP_PRODUCTS = {
  family_monthly:  'com.myfavoritebook.app.family.monthly',
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

async function ensureRC() {
  if (!IS_NATIVE) return false
  if (_Purchases) return true
  const mod = await import('@revenuecat/purchases-capacitor')
  _Purchases = mod.Purchases
  return true
}

export async function initRevenueCat(userId) {
  if (!IS_NATIVE) return
  try {
    const ok = await ensureRC()
    if (!ok) return
    const apiKey = import.meta.env.VITE_REVENUECAT_IOS_KEY
    if (!apiKey) {
      console.warn('[IAP] VITE_REVENUECAT_IOS_KEY not set')
      return
    }
    await _Purchases.configure({ apiKey })
    if (userId) {
      await _Purchases.logIn({ appUserID: userId })
    }
  } catch (e) {
    console.error('[IAP] initRevenueCat error', e)
  }
}

export async function getOfferings() {
  try {
    const ok = await ensureRC()
    if (!ok) return null
    const { current } = await _Purchases.getOfferings()
    return current
  } catch (e) {
    console.error('[IAP] getOfferings error', e)
    return null
  }
}

export async function purchasePackage(planName, billing) {
  const ok = await ensureRC()
  if (!ok) throw new Error('IAP not available')

  const productId = IAP_PRODUCTS[`${planName}_${billing}`]
  if (!productId) throw new Error('Unknown product')

  const offering = await getOfferings()
  if (!offering) throw new Error('No offerings available')

  const pkg = offering.availablePackages.find(
    (p) => p.product.identifier === productId
  )
  if (!pkg) throw new Error(`Package not found: ${productId}`)

  const { customerInfo } = await _Purchases.purchasePackage({ aPackage: pkg })
  return customerInfo
}

// Purchase a consumable coin pack via StoreKit. Returns true when the
// transaction succeeds; the RevenueCat webhook then credits coins
// server-side via add_coins. The caller should refresh the balance
// afterwards rather than trust any amount from the client.
export async function purchaseCoinPack(packKey) {
  const ok = await ensureRC()
  if (!ok) throw new Error('IAP not available')

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
  const ok = await ensureRC()
  if (!ok) throw new Error('IAP not available')
  const { customerInfo } = await _Purchases.restorePurchases()
  return customerInfo
}

export async function getCustomerInfo() {
  try {
    const ok = await ensureRC()
    if (!ok) return null
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
