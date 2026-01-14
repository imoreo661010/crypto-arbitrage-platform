import WebSocket from 'ws'
import axios from 'axios'
import { BaseExchangeAdapter } from '../base/ExchangeAdapter.js'

export class KucoinSpotAdapter extends BaseExchangeAdapter {
  exchange = 'kucoin' as const
  marketType = 'spot' as const
  private ws: WebSocket | null = null
  private exchangeRate = 1380
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private connectId = 0

  setExchangeRate(rate: number) { this.exchangeRate = rate }

  async connect(): Promise<void> {
    try {
      const res = await axios.post('https://api.kucoin.com/api/v1/bullet-public')
      const { token, instanceServers } = res.data.data
      const server = instanceServers[0]
      const endpoint = `${server.endpoint}?token=${token}&connectId=${++this.connectId}`

      return new Promise((resolve) => {
        this.ws = new WebSocket(endpoint)

        this.ws.on('open', () => {
          console.log('[KucoinSpot] 연결됨')
          this.connected = true

          // KuCoin pingInterval from server (default 30s)
          const pingMs = server.pingInterval || 30000
          this.pingInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({
                id: Date.now().toString(),
                type: 'ping'
              }))
            }
          }, pingMs)

          resolve()
        })

        this.ws.on('message', (data: Buffer) => {
          try {
            const msg = JSON.parse(data.toString())

            // 디버그: 첫 몇 개 메시지 로그 (나중에 제거)
            if (Math.random() < 0.001) {
              console.log('[KucoinSpot] 메시지:', JSON.stringify(msg).slice(0, 200))
            }

            // KuCoin ticker message
            // 문서 기준: { type: "message", subject: "trade.ticker", data: { price: "..." } }
            if (msg.type === 'message' && msg.subject === 'trade.ticker' && msg.data) {
              const d = msg.data
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
                    timestamp: Date.now()
                  })
                }
              }
            }
          } catch {}
        })

        this.ws.on('error', () => {})
        this.ws.on('close', () => { this.connected = false })
      })
    } catch (err) {
      console.error('[KucoinSpot] 연결 실패')
      this.connected = false
    }
  }

  subscribe(symbols: string[]) {
    this.subscribedSymbols = symbols

    if (this.ws?.readyState === WebSocket.OPEN) {
      // KuCoin: 개별 심볼 구독
      symbols.slice(0, 100).forEach((s, i) => {
        setTimeout(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
              id: Date.now().toString(),
              type: 'subscribe',
              topic: `/market/ticker:${s}-USDT`,
              response: true  // 구독 확인 받기
            }))
          }
        }, i * 50) // 50ms 간격으로 구독 (rate limit 방지)
      })

      console.log(`[KucoinSpot] 구독: ${Math.min(symbols.length, 100)}개`)
    }
  }

  disconnect() {
    if (this.pingInterval) clearInterval(this.pingInterval)
    this.ws?.close()
    this.connected = false
  }
}
