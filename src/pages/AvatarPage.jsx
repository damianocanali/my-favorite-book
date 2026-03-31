import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Coins, Lock, Check, Award } from 'lucide-react'
import { useAvatarStore } from '../stores/useAvatarStore'
import { useRewardsStore } from '../stores/useRewardsStore'
import { CATEGORIES, isItemUnlocked } from '../lib/avatarItems'
import AvatarDisplay from '../components/avatar/AvatarDisplay'
import ParentalGate from '../components/ui/ParentalGate'
import { useAuthStore } from '../stores/useAuthStore'

function ItemButton({ item, isEquipped, isUnlocked, onSelect, onPurchase }) {
  const needsCoins = item.unlock === 'coins' && !isUnlocked
  const needsBadge = typeof item.unlock === 'string' && item.unlock !== 'coins' && item.unlock !== 'free' && !isUnlocked

  return (
    <motion.button
      onClick={() => {
        if (isUnlocked) onSelect()
        else if (needsCoins) onPurchase()
      }}
      className={`relative flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all cursor-pointer min-w-[64px] ${
        isEquipped
          ? 'border-galaxy-primary bg-galaxy-primary/20 shadow-glow'
          : isUnlocked
            ? 'border-galaxy-text-muted/20 bg-galaxy-bg-light hover:border-galaxy-primary/50'
            : needsBadge
              ? 'border-galaxy-text-muted/10 bg-galaxy-bg-light/50 opacity-50 cursor-not-allowed'
              : 'border-yellow-400/30 bg-yellow-400/5 hover:border-yellow-400/60'
      }`}
      whileHover={!needsBadge ? { scale: 1.05 } : {}}
      whileTap={!needsBadge ? { scale: 0.95 } : {}}
      disabled={needsBadge}
      title={needsBadge ? `Earn the "${item.badge}" badge to unlock` : item.label}
    >
      {/* Item visual */}
      <div className="relative">
        {item.emoji ? (
          <span className="text-2xl">{item.emoji}</span>
        ) : (
          <div className="w-8 h-8 rounded-full border-2 border-dashed border-galaxy-text-muted/30 flex items-center justify-center">
            <span className="text-galaxy-text-muted text-xs">—</span>
          </div>
        )}

        {/* Color swatch */}
        {item.color && !item.color.startsWith('linear') && (
          <span
            className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border border-galaxy-bg"
            style={{ backgroundColor: item.color }}
          />
        )}
      </div>

      <span className="text-galaxy-text-muted text-[10px] font-body mt-1 line-clamp-1 max-w-[60px]">
        {item.label}
      </span>

      {/* Status badge */}
      {isEquipped && (
        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-galaxy-primary flex items-center justify-center">
          <Check size={10} className="text-white" />
        </span>
      )}
      {needsCoins && (
        <span className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-yellow-400/20 border border-yellow-400/40">
          <Coins size={8} className="text-yellow-400" />
          <span className="text-yellow-400 text-[9px] font-bold">{item.price}</span>
        </span>
      )}
      {needsBadge && (
        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-galaxy-text-muted/20 flex items-center justify-center">
          <Lock size={9} className="text-galaxy-text-muted" />
        </span>
      )}
    </motion.button>
  )
}

const COIN_PACKS = [
  { key: 'small', coins: 50, price: '$0.99', label: '50 Coins' },
  { key: 'medium', coins: 200, price: '$2.99', label: '200 Coins', popular: true },
  { key: 'large', coins: 500, price: '$4.99', label: '500 Coins' },
]

export default function AvatarPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const equipped = useAvatarStore((s) => s.equipped)
  const equip = useAvatarStore((s) => s.equip)
  const coins = useAvatarStore((s) => s.coins)
  const addCoins = useAvatarStore((s) => s.addCoins)
  const purchaseItem = useAvatarStore((s) => s.purchaseItem)
  const ownedItems = useAvatarStore((s) => s.ownedItems)
  const earnedBadges = useRewardsStore((s) => s.earnedBadges)
  const getBadges = useRewardsStore((s) => s.getBadges)
  const user = useAuthStore((s) => s.user)

  const [activeCategory, setActiveCategory] = useState('body')
  const [purchaseConfirm, setPurchaseConfirm] = useState(null)
  const [showBadges, setShowBadges] = useState(false)
  const [showParentalGate, setShowParentalGate] = useState(false)
  const [showCoinShop, setShowCoinShop] = useState(false)
  const [coinBuyLoading, setCoinBuyLoading] = useState(null)

  // Handle coins_added query param from Stripe redirect
  useEffect(() => {
    const coinsAdded = searchParams.get('coins_added')
    if (coinsAdded) {
      addCoins(parseInt(coinsAdded, 10))
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, addCoins, setSearchParams])

  const handleBuyCoins = async (pack) => {
    if (!user) return
    setCoinBuyLoading(pack.key)
    try {
      const res = await fetch('/api/buy-coins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack: pack.key, userId: user.id, userEmail: user.email }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert(data.error || 'Something went wrong')
    } catch {
      alert('Something went wrong')
    } finally {
      setCoinBuyLoading(null)
    }
  }

  const currentCategory = CATEGORIES.find((c) => c.key === activeCategory)
  const badges = getBadges()

  const handlePurchase = (item) => {
    if (coins >= item.price) {
      setPurchaseConfirm(item)
    }
  }

  const confirmPurchase = () => {
    if (purchaseConfirm) {
      const success = purchaseItem(purchaseConfirm.id, purchaseConfirm.price)
      if (success) {
        equip(activeCategory, purchaseConfirm.id)
      }
      setPurchaseConfirm(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="font-heading text-3xl font-bold text-galaxy-text mb-2">My Avatar</h1>
        <p className="text-galaxy-text-muted font-body">Customize your look!</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
        {/* Left: Avatar preview + coins */}
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <AvatarDisplay size={200} />

          {/* Coin balance */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-400/10 border border-yellow-400/30">
            <Coins size={18} className="text-yellow-400" />
            <span className="text-yellow-400 font-heading font-bold text-lg">{coins}</span>
            <span className="text-galaxy-text-muted font-body text-sm">coins</span>
          </div>

          {/* Get more coins */}
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
                  You can also earn free coins by completing badges!
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Badges button */}
          <button
            onClick={() => setShowBadges(!showBadges)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-galaxy-bg-light border border-galaxy-text-muted/20 hover:border-galaxy-primary/40 transition-colors"
          >
            <Award size={16} className="text-galaxy-primary" />
            <span className="text-galaxy-text font-body text-sm font-semibold">
              My Badges ({earnedBadges.length}/{badges.length})
            </span>
          </button>

          {/* Badges panel */}
          <AnimatePresence>
            {showBadges && (
              <motion.div
                className="w-full bg-galaxy-bg-light rounded-2xl p-4 border border-galaxy-text-muted/10"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="grid grid-cols-2 gap-2">
                  {badges.map((b) => (
                    <div
                      key={b.id}
                      className={`flex items-center gap-2 p-2 rounded-lg ${
                        b.earned ? 'bg-galaxy-primary/10' : 'opacity-40'
                      }`}
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

        {/* Right: Category tabs + items */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          {/* Category tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`px-4 py-2 rounded-full font-body text-sm font-semibold whitespace-nowrap transition-all ${
                  activeCategory === cat.key
                    ? 'bg-galaxy-primary text-white'
                    : 'bg-galaxy-bg-light text-galaxy-text-muted hover:text-galaxy-text border border-galaxy-text-muted/20'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Items grid */}
          <div className="bg-galaxy-bg-light rounded-2xl p-4 border border-galaxy-text-muted/10 min-h-[300px]">
            <div className="flex flex-wrap gap-2">
              {currentCategory?.items.map((item) => {
                const unlocked = isItemUnlocked(item, earnedBadges, ownedItems)
                const isEquipped = equipped[activeCategory] === item.id

                return (
                  <ItemButton
                    key={item.id}
                    item={item}
                    isEquipped={isEquipped}
                    isUnlocked={unlocked}
                    onSelect={() => equip(activeCategory, item.id)}
                    onPurchase={() => handlePurchase(item)}
                  />
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-galaxy-text-muted/10">
              <span className="flex items-center gap-1 text-galaxy-text-muted text-xs font-body">
                <span className="w-3 h-3 rounded-full bg-galaxy-primary/40" /> Equipped
              </span>
              <span className="flex items-center gap-1 text-galaxy-text-muted text-xs font-body">
                <Coins size={10} className="text-yellow-400" /> Buy with coins
              </span>
              <span className="flex items-center gap-1 text-galaxy-text-muted text-xs font-body">
                <Lock size={10} /> Earn badge to unlock
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Purchase confirmation modal */}
      <AnimatePresence>
        {purchaseConfirm && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setPurchaseConfirm(null)} />
            <motion.div
              className="relative bg-galaxy-bg-light rounded-2xl p-6 max-w-xs w-full border border-yellow-400/30 shadow-2xl text-center"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
            >
              <span className="text-5xl block mb-3">{purchaseConfirm.emoji}</span>
              <h3 className="font-heading text-lg font-bold text-galaxy-text mb-1">
                {purchaseConfirm.label}
              </h3>
              <div className="flex items-center justify-center gap-1.5 mb-4">
                <Coins size={16} className="text-yellow-400" />
                <span className="text-yellow-400 font-heading font-bold">{purchaseConfirm.price}</span>
                <span className="text-galaxy-text-muted font-body text-sm">coins</span>
              </div>
              {coins < purchaseConfirm.price ? (
                <p className="text-red-400 text-sm font-body mb-4">
                  Not enough coins! You need {purchaseConfirm.price - coins} more.
                </p>
              ) : (
                <p className="text-galaxy-text-muted text-sm font-body mb-4">
                  You'll have {coins - purchaseConfirm.price} coins left.
                </p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setPurchaseConfirm(null)}
                  className="flex-1 py-2.5 rounded-xl font-body font-semibold text-galaxy-text-muted border border-galaxy-text-muted/30 hover:border-galaxy-text-muted/60 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmPurchase}
                  disabled={coins < purchaseConfirm.price}
                  className="flex-1 py-2.5 rounded-xl font-body font-bold text-white bg-yellow-500 hover:bg-yellow-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  Buy!
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
