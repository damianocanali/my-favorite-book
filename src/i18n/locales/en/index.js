// Namespace barrel for "en". Imported as one chunk so a locale switch is a
// single network round-trip rather than fourteen.
import common from './common.json'
import nav from './nav.json'
import auth from './auth.json'
import account from './account.json'
import wizard from './wizard.json'
import editor from './editor.json'
import games from './games.json'
import gallery from './gallery.json'
import print from './print.json'
import pricing from './pricing.json'
import marketing from './marketing.json'
import legal from './legal.json'
import content from './content.json'
import errors from './errors.json'

export default {
  common, nav, auth, account, wizard, editor, games,
  gallery, print, pricing, marketing, legal, content, errors,
}
