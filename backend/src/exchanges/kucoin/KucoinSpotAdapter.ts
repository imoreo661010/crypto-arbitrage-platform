import WebSocket from 'ws'
import axios from 'axios'
import { BaseExchangeAdapter } from '../base/ExchangeAdapter.js'

export class KucoinSpotAdapter extends BaseExchangeAdapter {
  exchange = 'kucoin' as const
  marketType = 'spot' as const
  private ws: WebSocket | null = null
  private exchangeRate = 1380
  private pingInterval: ReturnType<typeof setInterval> | null = null

  setExchangeRate(rate: number) { this.exchangeRate = rate }

  async connect(): Promise<void> {
    try {
      // Step 1: Get token from KuCoin API
      const res = await axios.post('https://api.kucoin.com/api/v1/bullet-public')
      const { token, instanceServers } = res.data.data
      const endpoint = `${instanceServers[0].endpoint}?token=${token}`

      return new Promise((resolve) => {
        this.ws = new WebSocket(endpoint)

        this.ws.on('open', () => {
          console.log('[KucoinSpot] 연결됨')
          this.connected = true

          // KuCoin requires ping every 30 seconds
          this.pingInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({
                id: Date.now().toString(),
                type: 'ping'
              }))
            }
          }, 30000)

          resolve()
        })

        this.ws.on('message', (data: Buffer) => {
          try {
            const msg = JSON.parse(data.toString())

            // Handle ticker data
            if (msg.type === 'message' && msg.topic?.startsWith('/market/ticker:') && msg.data) {
              const d = msg.data
              // symbol format: "BTC-USDT" -> "BTC"
              const symbol = d.symbol?.replace('-USDT', '')

              if (symbol && this.subscribedSymbols.includes(symbol)) {
                const price = parseFloat(d.price || '0')
                if (price > 0) {
                  this.emitTicker({
                    exchange: this.exchange,
                    marketType: this.marketType,
                    symbol,
                    baseCurrency: 'USDT',
                    bid: price * this.exchangeRate,
                    ask: price * this.exchangeRate,
                    last: price * this.exchangeRate,
                    lastOriginal: price,
                    volume24h: parseFloat(d.size || d.vol || '0'),
                    timestamp: Date.now()
                  })
                }
              }
            }
          } catch {
            // Skip parse errors
          }
        })

        this.ws.on('error', (err) => {
          console.error('[KucoinSpot] WebSocket 에러:', err.message)
        })

        this.ws.on('close', () => {
          console.log('[KucoinSpot] 연결 종료')
          this.connected = false
        })
      })
    } catch (err) {
      console.error('[KucoinSpot] 연결 실패:', err)
      this.connected = false
    }
  }

  subscribe(symbols: string[]) {
    this.subscribedSymbols = symbols

    if (this.ws?.readyState === WebSocket.OPEN) {
      // KuCoin: subscribe to multiple tickers (max 100 per request)
      // Format: /market/ticker:BTC-USDT,ETH-USDT,...
      const pairs = symbols.slice(0, 100).map(s => `${s}-USDT`).join(',')

      this.ws.send(JSON.stringify({
        id: Date.now().toString(),
        type: 'subscribe',
        topic: `/market/ticker:${pairs}`,
        response: true
      }))

      console.log(`[KucoinSpot] 구독: ${Math.min(symbols.length, 100)}개`)
    }
  }

  disconnect() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
    this.ws?.close()
    this.connected = false
  }
}
