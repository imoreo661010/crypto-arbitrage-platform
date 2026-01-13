import { NormalizedTicker } from '../types/index.js'

export class PriceService {
  // 가격 저장소: Map<"symbol-exchange-marketType", NormalizedTicker>
  private prices: Map<string, NormalizedTicker> = new Map()

  /**
   * 가격 업데이트
   */
  updatePrice(ticker: NormalizedTicker): void {
    const { symbol, exchange, marketType } = ticker
    const key = `${symbol}-${exchange}-${marketType}`

    this.prices.set(key, ticker)

    // 로그는 1% 확률로만
    if (Math.random() < 0.01) {
      console.log(`[PriceService] ${key}: ₩${ticker.last.toLocaleString()}`)
    }
  }

  /**
   * 특정 코인, 특정 거래소-마켓 가격 조회
   */
  getPrice(symbol: string, exchange: string, marketType: string): NormalizedTicker | null {
    const key = `${symbol}-${exchange}-${marketType}`
    return this.prices.get(key) || null
  }

  /**
   * 전체 가격 데이터 조회
   */
  getAllPrices(): Map<string, NormalizedTicker> {
    return this.prices
  }

  /**
   * 전체 가격을 객체 형태로 변환 (심볼별로 그룹화)
   */
  getAllPricesAsObject(): Record<string, Record<string, NormalizedTicker>> {
    const result: Record<string, Record<string, NormalizedTicker>> = {}
    
    this.prices.forEach((ticker, key) => {
      const symbol = ticker.symbol
      const exchangeKey = `${ticker.exchange}-${ticker.marketType}`
      
      if (!result[symbol]) {
        result[symbol] = {}
      }
      
      result[symbol][exchangeKey] = ticker
    })
    
    return result
  }

  /**
   * 통계 조회
   */
  getStats() {
    return {
      totalPrices: this.prices.size
    }
  }
}