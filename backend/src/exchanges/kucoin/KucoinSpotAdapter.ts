import axios from 'axios'
import { BaseExchangeAdapter } from '../base/ExchangeAdapter.js'

// KuCoin REST API를 사용한 가격 조회
// WebSocket이 불안정해서 REST API polling으로 변경
export class KucoinSpotAdapter extends BaseExchangeAdapter {
  exchange = 'kucoin' as const
  marketType = 'spot' as const
  private exchangeRate = 1380
  private pollInterval: ReturnType<typeof setInterval> | null = null

  setExchangeRate(rate: number) { this.exchangeRate = rate }

  async connect(): Promise<void> {
    console.log('[KucoinSpot] REST API 모드로 연결됨')
    this.connected = true
  }

  subscribe(symbols: string[]) {
    this.subscribedSymbols = symbols

    // 기존 폴링 중지
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
    }

    // 1초마다 가격 조회
    this.pollInterval = setInterval(() => this.fetchPrices(), 1000)

    // 즉시 한 번 실행
    this.fetchPrices()

    console.log(`[KucoinSpot] 구독: ${symbols.length}개 (REST API polling)`)
  }

  private async fetchPrices() {
    try {
      // KuCoin API - 모든 ticker 조회
      const res = await axios.get('https://api.kucoin.com/api/v1/market/allTickers', {
        timeout: 5000
      })

      const tickers = res.data?.data?.ticker || []

      for (const item of tickers) {
        if (!item.symbol?.endsWith('-USDT')) continue

        const symbol = item.symbol.replace('-USDT', '')

        if (this.subscribedSymbols.includes(symbol)) {
          const price = parseFloat(item.last || '0')
          const bid = parseFloat(item.buy || '0')
          const ask = parseFloat(item.sell || '0')

          if (price > 0) {
            this.emitTicker({
              exchange: this.exchange,
              marketType: this.marketType,
              symbol,
              baseCurrency: 'USDT',
              bid: (bid || price) * this.exchangeRate,
              ask: (ask || price) * this.exchangeRate,
              last: price * this.exchangeRate,
              lastOriginal: price,
              timestamp: Date.now()
            })
          }
        }
      }
    } catch (err) {
      // 에러 시 무시 (다음 폴링에서 재시도)
    }
  }

  disconnect() {
    if (this.pollInterval) clearInterval(this.pollInterval)
    this.connected = false
  }
}
