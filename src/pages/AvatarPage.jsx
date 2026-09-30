import { friendlyAiError } from '../lib/aiErrors'
import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Coins, Lock, Award, Wand2, Loader2, Sparkles, RefreshCw, Camera } from 'lucide-react'
import { apiFetchAuthed } from '../lib/api'
import { formatMoneyCents } from '../i18n/formats'
import { IS_NATIVE, purchaseCoinPack } from '../services/purchaseService'
import { useAvatarStore } from '../stores/useAvatarStore'
import { useRewardsStore } from '../stores/useRewardsStore'
import { useSubscription } from '../hooks/useSubscription'
import { useAuthStore } from '../stores/useAuthStore'
import { useIsStudent } from '../hooks/useIsStudent'
import { usePhotoCapture } from '../hooks/usePhotoCapture'
import AvatarDisplay from '../components/avatar/AvatarDisplay'
import ParentalGate from '../components/ui/ParentalGate'
import SparkleButton from '../components/ui/SparkleButton'
import {
  SKIN_TONES, HAIR_STYLES, HAIR_COLORS, CLOTHING_OPTIONS,
  HAT_OPTIONS, ACCESSORY_OPTIONS, EXPRESSION_OPTIONS, ART_STYLES,
} from '../components/avatar/avatarCatalog'

// `key` is the wire value posted to /api/buy-coins (and the RevenueCat
// product mapping on native). Prices are minor units so Intl can place the
// symbol per locale.
const COIN_PACKS = [
  { key: 'small', coins: 50, priceCents: 99 },
  { key: 'medium', coins: 200, priceCents: 299, popular: true },
  { key: 'large', coins: 500, priceCents: 499 },
]

const REGEN_COIN_COST = 10
const STYLE_CHANGE_COIN_COST = 5

// --- Selector component ---
function OptionRow({ label, options, value, onChange, colorKey }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1.5">
      <p className="text-galaxy-text-muted text-xs font-body font-semibold">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body transition-all ${
              value === opt.id
                ? 'bg-galaxy-primary text-white font-bold'
                : 'glass border border-galaxy-text-muted/20 text-galaxy-text-muted hover:text-galaxy-text hover:border-galaxy-primary/40'
            }`}
          >
            {colorKey && opt[colorKey] && (
              <span
                className="w-3 h-3 rounded-full border border-white/30 shrink-0"
                style={{ backgroundColor: opt[colorKey] }}
              />
            )}
            {t(opt.labelKey)}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function AvatarPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const features = useAvatarStore((s) => s.features)
  const setFeature = useAvatarStore((s) => s.setFeature)
  const artStyle = useAvatarStore((s) => s.artStyle)
  const setArtStyle = useAvatarStore((s) => s.setArtStyle)
  const avatarImage = useAvatarStore((s) => s.avatarImage)
  const setAvatarImage = useAvatarStore((s) => s.setAvatarImage)
  const earnBadge = useRewardsStore((s) => s.earnBadge)
  const coins = useAvatarStore((s) => s.coins)
  const spendCoins = useAvatarStore((s) => s.spendCoins)
  const refreshCoins = useAvatarStore((s) => s.refreshCoins)
  const ownedStyles = useAvatarStore((s) => s.ownedStyles)
  const purchaseStyle = useAvatarStore((s) => s.purchaseStyle)
  const incrementGenerations = useAvatarStore((s) => s.incrementGenerations)
  const getGenerationsToday = useAvatarStore((s) => s.getGenerationsToday)
  const earnedBadges = useRewardsStore((s) => s.earnedBadges)
  const getBadges = useRewardsStore((s) => s.getBadges)
  const user = useAuthStore((s) => s.user)
  const { plan, planKey } = useSubscription()
  const isStudent = useIsStudent()

  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [showBadges, setShowBadges] = useState(false)
  const [showParentalGate, setShowParentalGate] = useState(false)
  const [photoGateOpen, setPhotoGateOpen] = useState(false)
  const { capturePhoto } = usePhotoCapture()
  const [showCoinShop, setShowCoinShop] = useState(false)
  const [coinBuyLoading, setCoinBuyLoading] = useState(null)

  const badges = getBadges()
  const generationsUsed = getGenerationsToday()
  const isFirstGeneration = !avatarImage
  const canGenerateFree = isFirstGeneration || plan.freeAvatarRegen && generationsUsed < plan.avatarGenerations

  // Pull the authoritative balance on mount and after Stripe redirects.
  useEffect(() => {
    if (!user) return
    refreshCoins()
    if (searchParams.get('coins_purchased')) {
      setSearchParams({}, { replace: true })
    }
  }, [user, refreshCoins, searchParams, setSearchParams])

  const handleGenerate = async () => {
    setError(null)
    setGenerating(true)

    // Regenerations past the free daily allowance cost coins. Debit via
    // the server so localStorage tampering can't grant free regens.
    if (!canGenerateFree) {
      const newBalance = await spendCoins(REGEN_COIN_COST)
      if (newBalance === null) {
        setError(t('account:avatar.errors.not_enough_coins_regen', { count: REGEN_COIN_COST }))
        setGenerating(false)
        return
      }
    }

    try {
      const res = await apiFetchAuthed('/api/generate-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features, artStyle }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('account:avatar.errors.generate_failed'))
      setAvatarImage(data.image)
      earnBadge('made_avatar')
      incrementGenerations()
    } catch (err) {
      setError(friendlyAiError(err, t))
      // Refresh balance so the UI reflects the debit even though the
      // generation failed — we don't refund automatically.
      refreshCoins()
    } finally {
      setGenerating(false)
    }
  }

  const handlePhotoCartoonify = async () => {
    setPhotoGateOpen(false)
    setError(null)
    setGenerating(true)

    // Photo cartoonify counts as a regen for billing — same coin cost as
    // a normal regenerate when the daily free quota is used up.
    if (!canGenerateFree) {
      const newBalance = await spendCoins(REGEN_COIN_COST)
      if (newBalance === null) {
        setError(t('account:avatar.errors.not_enough_coins_photo', { count: REGEN_COIN_COST }))
        setGenerating(false)
        return
      }
    }

    try {
      const sourceImage = await capturePhoto()
      const res = await apiFetchAuthed('/api/generate-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceImage, artStyle }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('account:avatar.errors.cartoonify_failed'))
      setAvatarImage(data.image)
      earnBadge('made_avatar')
      incrementGenerations()
    } catch (err) {
      // Camera permission denied / user cancel produces a benign error;
      // don't show as a payment failure.
      const msg = err?.message ?? String(err)
      if (!/cancel/i.test(msg) && !/no photo/i.test(msg) && !/no file/i.test(msg)) {
        setError(msg)
        refreshCoins()
      }
    } finally {
      setGenerating(false)
    }
  }

  const handleStyleChange = async (styleId) => {
    if (ownedStyles.includes(styleId)) {
      setArtStyle(styleId)
      return
    }
    const style = ART_STYLES.find((s) => s.id === styleId)
    if (!style) return

    if (plan.freeStyleChange) {
      await purchaseStyle(styleId, 0)
      setArtStyle(styleId)
      return
    }

    const cost = style.price
    if (coins < cost) return
    const ok = await purchaseStyle(styleId, cost)
    if (ok) setArtStyle(styleId)
  }

  const handleBuyCoins = async (pack) => {
    if (!user) return
    setCoinBuyLoading(pack.key)
    try {
      if (IS_NATIVE) {
        // App Store guideline 3.1.1 — in-app currency purchases on iOS must
        // go through StoreKit. RevenueCat's webhook credits the balance
        // server-side; we just refresh afterwards.
        await purchaseCoinPack(pack.key)
        // Webhook may race with our refresh; give it a beat then poll once.
        await refreshCoins()
        setTimeout(() => { refreshCoins() }, 2500)
      } else {
        const res = await apiFetchAuthed('/api/buy-coins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pack: pack.key }),
        })
        const data = await res.json()
        if (data.url) window.location.href = data.url
        else alert(data.error || t('common:state.error'))
      }
    } catch (e) {
      // RevenueCat throws with userCancelled when the user dismisses the
      // native sheet — treat that as silent.
      const cancelled = e?.userCancelled || /cancell?ed/i.test(e?.message || '')
      if (!cancelled) alert(e?.message || t('common:state.error'))
    } finally {
      setCoinBuyLoading(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="font-heading text-3xl font-bold text-galaxy-text mb-2">{t('account:avatar.title')}</h1>
        <p className="text-galaxy-text-muted font-body">{t('account:avatar.subtitle')}</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr] gap-6 sm:gap-8">
        {/* Left: Preview + actions */}
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          {/* Avatar preview */}
          <div className="relative">
            <AvatarDisplay size={220} />
            {generating && (
              <div className="absolute inset-0 rounded-full bg-galaxy-bg/80 flex items-center justify-center">
                <Loader2 size={40} className="text-galaxy-primary animate-spin" />
              </div>
            )}
          </div>

          {/* Generate button */}
          <SparkleButton
            onClick={handleGenerate}
            disabled={generating}
            size="large"
            variant="primary"
            className="w-full max-w-[280px] w-full"
          >
            <span className="flex items-center justify-center gap-2">
              {generating ? (
                <><Loader2 size={18} className="animate-spin" /> {t('account:avatar.generating')}</>
              ) : avatarImage ? (
                <><RefreshCw size={18} /> {canGenerateFree
                  ? t('account:avatar.regenerate')
                  : t('account:avatar.regenerate_cost', { count: REGEN_COIN_COST })}</>
              ) : (
                <><Wand2 size={18} /> {t('account:avatar.create_cta')}</>
              )}
            </span>
          </SparkleButton>

          {/* Photo cartoonify — alternative to feature-builder generation.
              Uploading a child's photo is a consumer/parental-gate feature;
              a class (student) account never gets this entry point. */}
          {!isStudent && (
            <>
              <button
                type="button"
                onClick={() => setPhotoGateOpen(true)}
                disabled={generating}
                className="w-full max-w-[280px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl glass border border-galaxy-text-muted/20 text-galaxy-text hover:border-galaxy-primary/50 hover:bg-galaxy-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-body"
              >
                <Camera size={16} className="text-galaxy-primary" />
                <span>{t('account:avatar.photo.cta')}</span>
              </button>
              <p className="text-galaxy-text-muted/70 text-[11px] font-body text-center max-w-[280px]">
                {t('account:avatar.photo.hint')}
              </p>
            </>
          )}

          {/* Generation info */}
          {plan.freeAvatarRegen && plan.avatarGenerations !== Infinity && (
            <p className="text-galaxy-text-muted text-xs font-body">
              {t('account:avatar.free_generations_left', { count: Math.max(0, plan.avatarGenerations - generationsUsed) })}
            </p>
          )}

          {error && (
            <p className="text-red-400 text-sm font-body text-center max-w-[280px] w-full">{error}</p>
          )}

          {/* Coin balance */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-400/10 border border-yellow-400/30">
            <Coins size={18} className="text-yellow-400" />
            <span className="text-yellow-400 font-heading font-bold text-lg">{coins}</span>
            <span className="text-galaxy-text-muted font-body text-sm">{t('account:avatar.coins_suffix')}</span>
          </div>

          {/* Coin store — real-money purchases. Children see no prices, no
              purchase links (global constraint): a class (student) account
              never gets this entry point. */}
          {!isStudent && (
            <button
              onClick={() => setShowParentalGate(true)}
              className="text-galaxy-text-muted text-xs font-body hover:text-galaxy-secondary transition-colors underline underline-offset-2"
            >
              {t('account:avatar.get_more_coins')}
            </button>
          )}

          {/* Coin shop */}
          <AnimatePresence>
            {!isStudent && showCoinShop && (
              <motion.div
                className="w-full glass rounded-2xl p-4 border border-yellow-400/20"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <p className="text-galaxy-text font-body text-sm font-semibold mb-3 text-center">{t('account:avatar.coin_shop.title')}</p>
                <div className="space-y-2">
                  {COIN_PACKS.map((pack) => (
                    <button
                      key={pack.key}
                      onClick={() => handleBuyCoins(pack)}
                      disabled={coinBuyLoading === pack.key}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                        pack.popular
                          ? 'border-yellow-400/50 bg-yellow-400/5 hover:bg-yellow-400/10'
                          : 'border-galaxy-text-muted/20 hover:border-galaxy-text-muted/40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {/* Stack, pouch, chest — the picture grows with the pack. */}
                        <StoreIcon src={`/store/coins-${pack.key}.png`} size={40} fallback={<Coins size={16} className="text-yellow-400" />} />
                        <span className="text-galaxy-text font-body font-semibold text-sm">
                          {t('account:avatar.coin_shop.pack', { count: pack.coins })}
                        </span>
                        {pack.popular && (
                          <span className="text-[10px] font-bold text-yellow-400 bg-yellow-400/20 px-1.5 py-0.5 rounded-full">
                            {t('account:avatar.coin_shop.best_value')}
                          </span>
                        )}
                      </div>
                      <span className="text-galaxy-text-muted font-body text-sm">
                        {coinBuyLoading === pack.key
                          ? t('account:avatar.coin_shop.loading')
                          : formatMoneyCents(pack.priceCents)}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="text-galaxy-text-muted text-[10px] font-body text-center mt-2">
                  {t('account:avatar.coin_shop.earn_hint')}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Badges */}
          <button
            onClick={() => setShowBadges(!showBadges)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl glass border border-galaxy-text-muted/20 hover:border-galaxy-primary/40 transition-colors w-full max-w-[280px] w-full"
          >
            <Award size={16} className="text-galaxy-primary" />
            <span className="text-galaxy-text font-body text-sm font-semibold">
              {t('account:avatar.badges_button', { earned: earnedBadges.length, total: badges.length })}
            </span>
          </button>

          <AnimatePresence>
            {showBadges && (
              <motion.div
                className="w-full glass rounded-2xl p-4 border border-galaxy-text-muted/10 max-w-[280px] w-full"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {badges.map((b) => (
                    <div
                      key={b.id}
                      className={`flex items-center gap-2 p-2 rounded-lg ${b.earned ? 'bg-galaxy-primary/10' : 'opacity-40'}`}
                    >
                      <span className="text-xl">{b.emoji}</span>
                      <div>
                        <p className="text-galaxy-text text-xs font-body font-semibold">{b.label}</p>
                        <p className="text-galaxy-text-muted text-[10px] font-body">{b.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Right: Customization options */}
        <motion.div
          className="space-y-5"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          {/* Art style picker */}
          <div className="glass rounded-2xl p-5 border border-galaxy-text-muted/10">
            <p className="text-galaxy-text font-body text-sm font-bold mb-3 flex items-center gap-2">
              <Sparkles size={16} className="text-galaxy-primary" /> {t('account:avatar.art_style.title')}
            </p>
            <div className="flex flex-wrap gap-2">
              {ART_STYLES.map((style) => {
                const owned = ownedStyles.includes(style.id)
                const active = artStyle === style.id
                return (
                  <button
                    key={style.id}
                    onClick={() => handleStyleChange(style.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-body transition-all ${
                      active
                        ? 'bg-galaxy-primary text-white font-bold'
                        : owned
                          ? 'glass border border-white/15 text-galaxy-text hover:border-galaxy-primary/50'
                          : 'bg-galaxy-bg border border-yellow-400/30 text-galaxy-text-muted hover:border-yellow-400/60'
                    }`}
                  >
                    <StoreIcon src={`/store/style-${style.id}.png`} size={28} fallback={<span>{style.emoji}</span>} />
                    {t(style.labelKey)}
                    {!owned && style.price > 0 && (
                      <span className="flex items-center gap-0.5 text-yellow-400 text-xs">
                        <Coins size={10} />{style.price}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Feature selectors */}
          <div className="glass rounded-2xl p-5 border border-galaxy-text-muted/10 space-y-4">
            <OptionRow
              label={t('account:avatar.features.skin_tone')}
              options={SKIN_TONES}
              value={features.skinTone}
              onChange={(v) => setFeature('skinTone', v)}
              colorKey="color"
            />

            <OptionRow
              label={t('account:avatar.features.hair_style')}
              options={HAIR_STYLES}
              value={features.hairStyle}
              onChange={(v) => setFeature('hairStyle', v)}
            />

            {features.hairStyle !== 'none' && (
              <OptionRow
                label={t('account:avatar.features.hair_color')}
                options={HAIR_COLORS}
                value={features.hairColor}
                onChange={(v) => setFeature('hairColor', v)}
                colorKey="color"
              />
            )}

            <OptionRow
              label={t('account:avatar.features.clothing')}
              options={CLOTHING_OPTIONS}
              value={features.clothing}
              onChange={(v) => setFeature('clothing', v)}
            />

            <OptionRow
              label={t('account:avatar.features.hat')}
              options={HAT_OPTIONS}
              value={features.hat}
              onChange={(v) => setFeature('hat', v)}
            />

            <OptionRow
              label={t('account:avatar.features.accessory')}
              options={ACCESSORY_OPTIONS}
              value={features.accessory}
              onChange={(v) => setFeature('accessory', v)}
            />

            <OptionRow
              label={t('account:avatar.features.expression')}
              options={EXPRESSION_OPTIONS}
              value={features.expression}
              onChange={(v) => setFeature('expression', v)}
            />
          </div>

          {/* Upgrade nudge for free users — a class (student) account never
              sees a pricing link (global constraint). */}
          {planKey === 'free' && !isStudent && (
            <motion.div
              className="bg-galaxy-primary/10 rounded-2xl p-5 border border-galaxy-primary/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <p className="text-galaxy-text font-body text-sm font-bold mb-1">{t('account:avatar.upgrade.title')}</p>
              <p className="text-galaxy-text-muted font-body text-xs mb-3">
                {t('account:avatar.upgrade.body')}
              </p>
              <SparkleButton onClick={() => navigate('/pricing')} size="small" variant="secondary">
                {t('account:avatar.upgrade.cta')}
              </SparkleButton>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Parental gate for coin purchases */}
      {showParentalGate && (
        <ParentalGate
          onPass={() => {
            setShowParentalGate(false)
            setShowCoinShop(true)
          }}
          onClose={() => setShowParentalGate(false)}
        />
      )}

      {/* Parental gate for camera access (photo cartoonify). Required by App
          Store kids' app guidelines + COPPA — a parent must explicitly
          authorize camera access for the child. */}
      {photoGateOpen && (
        <ParentalGate
          onPass={handlePhotoCartoonify}
          onClose={() => setPhotoGateOpen(false)}
        />
      )}
    </div>
  )
}

// The picture on a store item. Emoji stood in for everything a child can buy;
// for something paid for with real money that read as unfinished, and
// "Watercolor" as 🖌️ said nothing about what you get. Art styles now show the
// same boy drawn IN that style, so the icon is a preview. If the file is ever
// missing, the original emoji or icon comes back rather than a broken image.
function StoreIcon({ src, size, fallback }) {
  const [failed, setFailed] = useState(false)
  if (failed) return fallback
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="shrink-0 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
      style={{ width: size, height: size }}
    />
  )
}

