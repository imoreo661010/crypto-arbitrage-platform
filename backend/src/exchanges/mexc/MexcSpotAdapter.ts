import axios from 'axios'
import { BaseExchangeAdapter } from '../base/ExchangeAdapter.js'

// MEXC v3 REST API를 사용한 가격 조회
// WebSocket v3는 Protobuf 형식이라 복잡하므로 REST API polling 사용
export class MexcSpotAdapter extends BaseExchangeAdapter {
  exchange = 'mexc' as const
  marketType = 'spot' as const
  private exchangeRate = 1380
  private pollInterval: ReturnType<typeof setInterval> | null = null

  setExchangeRate(rate: number) { this.exchangeRate = rate }

  async connect(): Promise<void> {
    console.log('[MexcSpot] REST API 모드로 연결됨')
    this.connected = true
  }

  subscribe(symbols: string[]) {
    this.subscribedSymbols = symbols

    // 기존 폴링 중지
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
    }

    // 5초마다 가격 조회 (메모리 절약)
    this.pollInterval = setInterval(() => this.fetchPrices(), 5000)

    // 즉시 한 번 실행
    this.fetchPrices()

    console.log(`[MexcSpot] 구독: ${symbols.length}개 (REST API polling)`)
  }

  private async fetchPrices() {
    try {
      // MEXC v3 API - 모든 가격 조회
      const res = await axios.get('https://api.mexc.com/api/v3/ticker/price', {
        timeout: 5000
      })

      const prices: Array<{ symbol: string; price: string }> = res.data

      for (const item of prices) {
        if (!item.symbol.endsWith('USDT')) continue

        const symbol = item.symbol.replace('USDT', '')

        if (this.subscribedSymbols.includes(symbol)) {
          const price = parseFloat(item.price)

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
    } catch (err) {
      // 에러 시 무시 (다음 폴링에서 재시도)
    }
  }

  disconnect() {
    if (this.pollInterval) clearInterval(this.pollInterval)
    this.connected = false
  }
}
