// /example — a public marketing page showing a complete printed-book
// experience. Anyone (logged in or not) can flip through "Theo and the
// Star Bear" and see exactly what their printed book will look like
// before paying. The story pages flip like a real book; the back-matter
// section below lists the curated pages added at print time.
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Sparkles, Printer } from 'lucide-react'
import { SAMPLE_BOOK } from '../data/sampleBook'
import BookPreview from '../components/book/BookPreview'
import BackMatterPreview from '../components/print/BackMatterPreview'

export default function ExampleBookPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-galaxy-bg text-galaxy-text font-body">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <p className="text-galaxy-text-muted text-sm uppercase tracking-wide mb-2">A printed example</p>
          <h1 className="font-heading text-3xl md:text-4xl font-bold mb-3">
            What your printed book looks like
          </h1>
          <p className="text-galaxy-text-muted max-w-xl mx-auto">
            Tap or drag to flip through the full printed edition of <span className="font-semibold text-galaxy-text">"Theo and the Star Bear"</span> — story pages, back-of-book extras, and all.
          </p>
        </motion.header>

        {/* Flip-book preview of the whole book — story + curated back matter */}
        <div className="mb-10 flex justify-center">
          <BookPreview book={SAMPLE_BOOK} includeBackMatter />
        </div>

        <div className="mb-2 text-center">
          <h2 className="font-heading text-xl font-semibold">What's inside, at a glance</h2>
          <p className="text-galaxy-text-muted text-sm mt-1">
            Every printed book ships with these curated pages after the story.
          </p>
        </div>

        <div className="mb-10">
          <BackMatterPreview book={SAMPLE_BOOK} />
        </div>

        {/* Two-action CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          <button
            onClick={() => navigate('/create')}
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-galaxy-primary text-white font-heading font-bold hover:bg-purple-500 transition-colors"
          >
            <Sparkles size={16} />
            Start your own book
          </button>
          <button
            onClick={() => navigate('/pricing')}
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-galaxy-bg-light border border-galaxy-text-muted/20 text-galaxy-text hover:border-galaxy-text-muted/40 transition-colors"
          >
            <Printer size={16} />
            See pricing
          </button>
        </motion.div>

        <p className="text-center text-xs text-galaxy-text-muted/60 mt-8">
          This sample story was generated with MyBookLab. Order a real printed copy of any book you create — hardcover or softcover, shipped anywhere in the US.
        </p>
      </div>
    </div>
  )
}
