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

let _purchases = null

async function getRC() {
  if (!IS_NATIVE) return null
  if (_purchases) return _purchases
  const { Purchases } = await import('@revenuecat/purchases-capacitor')
  _purchases = Purchases
  return _purchases
}

export async function initRevenueCat(userId) {
  if (!IS_NATIVE) return
  try {
    const RC = await getRC()
    const apiKey = import.meta.env.VITE_REVENUECAT_IOS_KEY
    if (!apiKey) {
      console.warn('[IAP] VITE_REVENUECAT_IOS_KEY not set')
      return
    }
    await RC.configure({ apiKey })
    if (userId) {
      await RC.logIn({ appUserID: userId })
    }
  } catch (e) {
    console.error('[IAP] initRevenueCat error', e)
  }
}

export async function getOfferings() {
  try {
    const RC = await getRC()
    if (!RC) return null
    const { current } = await RC.getOfferings()
    return current
  } catch (e) {
    console.error('[IAP] getOfferings error', e)
    return null
  }
}

export async function purchasePackage(planName, billing) {
  const RC = await getRC()
  if (!RC) throw new Error('IAP not available')

  const productId = IAP_PRODUCTS[`${planName}_${billing}`]
  if (!productId) throw new Error('Unknown product')

  const offering = await getOfferings()
  if (!offering) throw new Error('No offerings available')

  const pkg = offering.availablePackages.find(
    (p) => p.product.identifier === productId
  )
  if (!pkg) throw new Error(`Package not found: ${productId}`)

  const { customerInfo } = await RC.purchasePackage({ aPackage: pkg })
  return customerInfo
}

// Purchase a consumable coin pack via StoreKit. Returns true when the
// transaction succeeds; the RevenueCat webhook then credits coins
// server-side via add_coins. The caller should refresh the balance
// afterwards rather than trust any amount from the client.
export async function purchaseCoinPack(packKey) {
  const RC = await getRC()
  if (!RC) throw new Error('IAP not available')

  const productId = COIN_PACK_IAP_PRODUCTS[packKey]
  if (!productId) throw new Error('Unknown coin pack')

  // Coin packs may live in a separate offering (e.g. "coins") or as
  // non-subscription packages on the default offering. Try the default
  // offering first, then fall back to getProducts for a direct purchase.
  const offering = await getOfferings()
  const pkg = offering?.availablePackages?.find(
    (p) => p.product.identifier === productId
  )

  if (pkg) {
    const { customerInfo } = await RC.purchasePackage({ aPackage: pkg })
    return { ok: true, customerInfo }
  }

  // Fallback: purchase the bare product. Some RC setups expose consumables
  // only via getProducts rather than as packages.
  const { products } = await RC.getProducts({ productIdentifiers: [productId] })
  const product = products?.[0]
  if (!product) throw new Error(`Product not found: ${productId}`)
  const { customerInfo } = await RC.purchaseStoreProduct({ product })
  return { ok: true, customerInfo }
}

export async function restorePurchases() {
  const RC = await getRC()
  if (!RC) throw new Error('IAP not available')
  const { customerInfo } = await RC.restorePurchases()
  return customerInfo
}

export async function getCustomerInfo() {
  try {
    const RC = await getRC()
    if (!RC) return null
    const { customerInfo } = await RC.getCustomerInfo()
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
