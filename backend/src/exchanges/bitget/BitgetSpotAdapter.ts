import WebSocket from 'ws'
import { BaseExchangeAdapter } from '../base/ExchangeAdapter.js'

export class BitgetSpotAdapter extends BaseExchangeAdapter {
  exchange = 'bitget' as const
  marketType = 'spot' as const
  private ws: WebSocket | null = null
  private exchangeRate = 1380
  private pingInterval: ReturnType<typeof setInterval> | null = null

  setExchangeRate(rate: number) { this.exchangeRate = rate }

  async connect(): Promise<void> {
    return new Promise((resolve) => {
      this.ws = new WebSocket('wss://ws.bitget.com/v2/ws/public')

      this.ws.on('open', () => {
        console.log('[BitgetSpot] 연결됨')
        this.connected = true

        // Bitget requires ping every 30 seconds
        this.pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send('ping')
          }
        }, 30000)

        resolve()
      })

      this.ws.on('message', (data: Buffer) => {
        try {
          const text = data.toString()
          // Handle pong response
          if (text === 'pong') return

          const msg = JSON.parse(text)

          // Handle ticker data
          if (msg.action === 'snapshot' || msg.action === 'update') {
            if (msg.data && Array.isArray(msg.data)) {
              msg.data.forEach((d: any) => {
                // instId format: "BTCUSDT" -> "BTC"
                const symbol = d.instId?.replace('USDT', '')

                if (symbol && this.subscribedSymbols.includes(symbol)) {
                  const price = parseFloat(d.lastPr || d.last || '0')
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
                      volume24h: parseFloat(d.baseVolume || d.vol24h || '0'),
                      timestamp: Date.now()
                    })
                  }
                }
              })
            }
          }
        } catch {
          // Skip parse errors
        }
      })

      this.ws.on('error', (err) => {
        console.error('[BitgetSpot] WebSocket 에러:', err.message)
      })

      this.ws.on('close', () => {
        console.log('[BitgetSpot] 연결 종료')
        this.connected = false
      })
    })
  }

  subscribe(symbols: string[]) {
    this.subscribedSymbols = symbols

    if (this.ws?.readyState === WebSocket.OPEN) {
      // Subscribe in batches of 30 to avoid message size limits
      const batchSize = 30
      for (let i = 0; i < Math.min(symbols.length, 100); i += batchSize) {
        const batch = symbols.slice(i, i + batchSize)
        const args = batch.map(s => ({
          instType: 'SPOT',
          channel: 'ticker',
          instId: `${s}USDT`
        }))

        this.ws.send(JSON.stringify({
          op: 'subscribe',
          args
        }))
      }

      console.log(`[BitgetSpot] 구독: ${Math.min(symbols.length, 100)}개`)
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
