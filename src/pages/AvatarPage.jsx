import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Coins, Lock, Award, Wand2, Loader2, Sparkles, RefreshCw } from 'lucide-react'
import { apiFetchAuthed } from '../lib/api'
import { IS_NATIVE, purchaseCoinPack } from '../services/purchaseService'
import { useAvatarStore } from '../stores/useAvatarStore'
import { useRewardsStore } from '../stores/useRewardsStore'
import { useSubscription } from '../hooks/useSubscription'
import { useAuthStore } from '../stores/useAuthStore'
import AvatarDisplay from '../components/avatar/AvatarDisplay'
import ParentalGate from '../components/ui/ParentalGate'
import SparkleButton from '../components/ui/SparkleButton'

// --- Feature options ---
const SKIN_TONES = [
  { id: 'light', label: 'Light', color: '#FFDBB4' },
  { id: 'fair', label: 'Fair', color: '#E8B88A' },
  { id: 'medium', label: 'Medium', color: '#C68642' },
  { id: 'dark', label: 'Dark', color: '#8D5524' },
  { id: 'peach', label: 'Peach', color: '#FFDBAC' },
  { id: 'tan', label: 'Tan', color: '#F1C27D' },
]

const HAIR_STYLES = [
  { id: 'none', label: 'None' },
  { id: 'short', label: 'Short' },
  { id: 'long', label: 'Long' },
  { id: 'curly', label: 'Curly' },
  { id: 'braids', label: 'Braids' },
  { id: 'ponytail', label: 'Ponytail' },
  { id: 'mohawk', label: 'Mohawk' },
  { id: 'afro', label: 'Afro' },
]

const HAIR_COLORS = [
  { id: 'brown', label: 'Brown', color: '#5C3317' },
  { id: 'black', label: 'Black', color: '#1A1A1A' },
  { id: 'blonde', label: 'Blonde', color: '#F5DEB3' },
  { id: 'red', label: 'Red', color: '#B7410E' },
  { id: 'pink', label: 'Pink', color: '#FF69B4' },
  { id: 'blue', label: 'Blue', color: '#4FC3F7' },
  { id: 'purple', label: 'Purple', color: '#9C27B0' },
]

const CLOTHING_OPTIONS = [
  { id: 'blue t-shirt', label: 'Blue T-Shirt' },
  { id: 'red hoodie', label: 'Red Hoodie' },
  { id: 'green jacket', label: 'Green Jacket' },
  { id: 'pink dress', label: 'Pink Dress' },
  { id: 'yellow sweater', label: 'Yellow Sweater' },
  { id: 'purple overalls', label: 'Purple Overalls' },
  { id: 'superhero cape', label: 'Super Cape' },
  { id: 'wizard robe', label: 'Wizard Robe' },
  { id: 'sports jersey', label: 'Sports Jersey' },
  { id: 'astronaut suit', label: 'Space Suit' },
]

const HAT_OPTIONS = [
  { id: 'none', label: 'None' },
  { id: 'baseball cap', label: 'Cap' },
  { id: 'beanie', label: 'Beanie' },
  { id: 'cowboy hat', label: 'Cowboy' },
  { id: 'crown', label: 'Crown' },
  { id: 'wizard hat', label: 'Wizard' },
  { id: 'party hat', label: 'Party' },
  { id: 'flower crown', label: 'Flowers' },
  { id: 'headphones', label: 'Headphones' },
  { id: 'pirate hat', label: 'Pirate' },
]

const ACCESSORY_OPTIONS = [
  { id: 'none', label: 'None' },
  { id: 'round glasses', label: 'Glasses' },
  { id: 'cool sunglasses', label: 'Sunglasses' },
  { id: 'star-shaped glasses', label: 'Star Glasses' },
  { id: 'a red scarf', label: 'Scarf' },
  { id: 'a magic wand', label: 'Wand' },
  { id: 'a backpack', label: 'Backpack' },
  { id: 'butterfly wings', label: 'Wings' },
]

const EXPRESSION_OPTIONS = [
  { id: 'happy smiling', label: 'Happy' },
  { id: 'excited laughing', label: 'Excited' },
  { id: 'cool confident', label: 'Cool' },
  { id: 'silly tongue out', label: 'Silly' },
  { id: 'brave determined', label: 'Brave' },
  { id: 'curious wondering', label: 'Curious' },
  { id: 'peaceful calm', label: 'Peaceful' },
]

const ART_STYLES = [
  { id: 'cartoon', label: 'Cartoon', emoji: '🎨', price: 0 },
  { id: 'pixar', label: 'Pixar 3D', emoji: '✨', price: 15 },
  { id: 'anime', label: 'Anime', emoji: '🌸', price: 15 },
  { id: 'watercolor', label: 'Watercolor', emoji: '🖌️', price: 15 },
  { id: 'pixel', label: 'Pixel Art', emoji: '👾', price: 15 },
]

const COIN_PACKS = [
  { key: 'small', coins: 50, price: '$0.99', label: '50 Coins' },
  { key: 'medium', coins: 200, price: '$2.99', label: '200 Coins', popular: true },
  { key: 'large', coins: 500, price: '$4.99', label: '500 Coins' },
]

const REGEN_COIN_COST = 10
const STYLE_CHANGE_COIN_COST = 5

// --- Selector component ---
function OptionRow({ label, options, value, onChange, colorKey }) {
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
                : 'bg-galaxy-bg-light border border-galaxy-text-muted/20 text-galaxy-text-muted hover:text-galaxy-text hover:border-galaxy-primary/40'
            }`}
          >
            {colorKey && opt[colorKey] && (
              <span
                className="w-3 h-3 rounded-full border border-white/30 shrink-0"
                style={{ backgroundColor: opt[colorKey] }}
              />
            )}
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function AvatarPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const features = useAvatarStore((s) => s.features)
  const setFeature = useAvatarStore((s) => s.setFeature)
  const artStyle = useAvatarStore((s) => s.artStyle)
  const setArtStyle = useAvatarStore((s) => s.setArtStyle)
  const avatarImage = useAvatarStore((s) => s.avatarImage)
  const setAvatarImage = useAvatarStore((s) => s.setAvatarImage)
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

  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [showBadges, setShowBadges] = useState(false)
  const [showParentalGate, setShowParentalGate] = useState(false)
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
        setError(`Not enough coins! You need ${REGEN_COIN_COST} coins to regenerate.`)
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
      if (!res.ok) throw new Error(data.error || 'Failed to generate avatar')
      setAvatarImage(data.image)
      incrementGenerations()
    } catch (err) {
      setError(err.message)
      // Refresh balance so the UI reflects the debit even though the
      // generation failed — we don't refund automatically.
      refreshCoins()
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
        else alert(data.error || 'Something went wrong')
      }
    } catch (e) {
      // RevenueCat throws with userCancelled when the user dismisses the
      // native sheet — treat that as silent.
      const cancelled = e?.userCancelled || /cancell?ed/i.test(e?.message || '')
      if (!cancelled) alert(e?.message || 'Something went wrong')
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
        <h1 className="font-heading text-3xl font-bold text-galaxy-text mb-2">My Avatar</h1>
        <p className="text-galaxy-text-muted font-body">Design your look, then bring it to life with AI!</p>
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
                <><Loader2 size={18} className="animate-spin" /> Creating...</>
              ) : avatarImage ? (
                <><RefreshCw size={18} /> Regenerate{!canGenerateFree ? ` (${REGEN_COIN_COST} coins)` : ''}</>
              ) : (
                <><Wand2 size={18} /> Create My Avatar!</>
              )}
            </span>
          </SparkleButton>

          {/* Generation info */}
          {plan.freeAvatarRegen && plan.avatarGenerations !== Infinity && (
            <p className="text-galaxy-text-muted text-xs font-body">
              {Math.max(0, plan.avatarGenerations - generationsUsed)} free generations left today
            </p>
          )}

          {error && (
            <p className="text-red-400 text-sm font-body text-center max-w-[280px] w-full">{error}</p>
          )}

          {/* Coin balance */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-400/10 border border-yellow-400/30">
            <Coins size={18} className="text-yellow-400" />
            <span className="text-yellow-400 font-heading font-bold text-lg">{coins}</span>
            <span className="text-galaxy-text-muted font-body text-sm">coins</span>
          </div>

          <button
            onClick={() => setShowParentalGate(true)}
            className="text-galaxy-text-muted text-xs font-body hover:text-galaxy-secondary transition-colors underline underline-offset-2"
          >
            Get more coins
          </button>

          {/* Coin shop */}
          <AnimatePresence>
            {showCoinShop && (
              <motion.div
                className="w-full bg-galaxy-bg-light rounded-2xl p-4 border border-yellow-400/20"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <p className="text-galaxy-text font-body text-sm font-semibold mb-3 text-center">Coin Packs</p>
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
                        <Coins size={16} className="text-yellow-400" />
                        <span className="text-galaxy-text font-body font-semibold text-sm">{pack.label}</span>
                        {pack.popular && (
                          <span className="text-[10px] font-bold text-yellow-400 bg-yellow-400/20 px-1.5 py-0.5 rounded-full">BEST VALUE</span>
                        )}
                      </div>
                      <span className="text-galaxy-text-muted font-body text-sm">
                        {coinBuyLoading === pack.key ? 'Loading...' : pack.price}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="text-galaxy-text-muted text-[10px] font-body text-center mt-2">
                  Earn free coins by completing badges!
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Badges */}
          <button
            onClick={() => setShowBadges(!showBadges)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-galaxy-bg-light border border-galaxy-text-muted/20 hover:border-galaxy-primary/40 transition-colors w-full max-w-[280px] w-full"
          >
            <Award size={16} className="text-galaxy-primary" />
            <span className="text-galaxy-text font-body text-sm font-semibold">
              My Badges ({earnedBadges.length}/{badges.length})
            </span>
          </button>

          <AnimatePresence>
            {showBadges && (
              <motion.div
                className="w-full bg-galaxy-bg-light rounded-2xl p-4 border border-galaxy-text-muted/10 max-w-[280px] w-full"
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
          <div className="bg-galaxy-bg-light rounded-2xl p-5 border border-galaxy-text-muted/10">
            <p className="text-galaxy-text font-body text-sm font-bold mb-3 flex items-center gap-2">
              <Sparkles size={16} className="text-galaxy-primary" /> Art Style
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
                          ? 'bg-galaxy-bg border border-galaxy-text-muted/20 text-galaxy-text hover:border-galaxy-primary/50'
                          : 'bg-galaxy-bg border border-yellow-400/30 text-galaxy-text-muted hover:border-yellow-400/60'
                    }`}
                  >
                    <span>{style.emoji}</span>
                    {style.label}
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
          <div className="bg-galaxy-bg-light rounded-2xl p-5 border border-galaxy-text-muted/10 space-y-4">
            <OptionRow
              label="Skin Tone"
              options={SKIN_TONES}
              value={features.skinTone}
              onChange={(v) => setFeature('skinTone', v)}
              colorKey="color"
            />

            <OptionRow
              label="Hair Style"
              options={HAIR_STYLES}
              value={features.hairStyle}
              onChange={(v) => setFeature('hairStyle', v)}
            />

            {features.hairStyle !== 'none' && (
              <OptionRow
                label="Hair Color"
                options={HAIR_COLORS}
                value={features.hairColor}
                onChange={(v) => setFeature('hairColor', v)}
                colorKey="color"
              />
            )}

            <OptionRow
              label="Clothing"
              options={CLOTHING_OPTIONS}
              value={features.clothing}
              onChange={(v) => setFeature('clothing', v)}
            />

            <OptionRow
              label="Hat"
              options={HAT_OPTIONS}
              value={features.hat}
              onChange={(v) => setFeature('hat', v)}
            />

            <OptionRow
              label="Accessories"
              options={ACCESSORY_OPTIONS}
              value={features.accessory}
              onChange={(v) => setFeature('accessory', v)}
            />

            <OptionRow
              label="Expression"
              options={EXPRESSION_OPTIONS}
              value={features.expression}
              onChange={(v) => setFeature('expression', v)}
            />
          </div>

          {/* Upgrade nudge for free users */}
          {planKey === 'free' && (
            <motion.div
              className="bg-galaxy-primary/10 rounded-2xl p-5 border border-galaxy-primary/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <p className="text-galaxy-text font-body text-sm font-bold mb-1">Want unlimited avatars?</p>
              <p className="text-galaxy-text-muted font-body text-xs mb-3">
                Family plan includes 5 free generations per day, unlimited books, and PDF export.
              </p>
              <SparkleButton onClick={() => navigate('/pricing')} size="small" variant="secondary">
                View Plans
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
    </div>
  )
}
