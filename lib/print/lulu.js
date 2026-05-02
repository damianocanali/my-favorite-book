// Minimal Lulu Direct API client (OAuth client credentials + REST).
// Docs: https://api.lulu.com/docs/

export class LuluClient {
  constructor({ base, clientKey, clientSecret } = {}) {
    this.base = base ?? process.env.LULU_API_BASE ?? 'https://api.sandbox.lulu.com'
    this.clientKey = clientKey ?? process.env.LULU_CLIENT_KEY
    this.clientSecret = clientSecret ?? process.env.LULU_CLIENT_SECRET
    this._token = null
    this._expiresAt = 0
  }

  async getToken() {
    if (this._token && Date.now() < this._expiresAt - 30_000) return this._token
    const credentials = Buffer.from(`${this.clientKey}:${this.clientSecret}`).toString('base64')
    const res = await fetch(`${this.base}/auth/realms/glasstree/protocol/openid-connect/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      throw new Error(`lulu auth failed (${res.status}): ${t}`)
    }
    const { access_token, expires_in } = await res.json()
    this._token = access_token
    this._expiresAt = Date.now() + (expires_in * 1000)
    return this._token
  }

  async _req(method, path, body) {
    const token = await this.getToken()
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body == null ? undefined : JSON.stringify(body),
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      throw new Error(`lulu ${method} ${path} failed (${res.status}): ${t}`)
    }
    return await res.json()
  }

  createPrintJob(payload) {
    return this._req('POST', '/print-jobs/', payload).catch((e) => {
      throw new Error(`lulu createPrintJob: ${e.message}`)
    })
  }

  getPrintJob(id) {
    return this._req('GET', `/print-jobs/${id}/`)
  }

  getShippingOptions(query) {
    const qs = new URLSearchParams(query).toString()
    return this._req('GET', `/shipping-options/?${qs}`)
  }

  // Returns { width, height, unit } for the cover spread Lulu expects.
  // Hardcover and softcover require very different spread sizes (the case
  // wraps around boards on hardcover), and Lulu validates strictly. Query
  // this at print-job time rather than computing locally.
  getCoverDimensions({ pod_package_id, interior_page_count, unit = 'inch' }) {
    return this._req('POST', '/cover-dimensions/', {
      pod_package_id, interior_page_count, unit,
    })
  }
}
