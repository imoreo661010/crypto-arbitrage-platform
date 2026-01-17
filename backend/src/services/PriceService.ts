import { NormalizedTicker } from '../types/index.js'

// 심볼 충돌로 인해 완전히 제외할 심볼 (모든 거래소에서 제외)
const GLOBALLY_EXCLUDED_SYMBOLS = ['BEAM', 'GAS']

// 거래소별 추가 제외 목록
const EXCLUDED_SYMBOLS: Record<string, string[]> = {}

export class PriceService {
  // 가격 저장소: Map<"symbol-exchange-marketType", NormalizedTicker>
  private prices: Map<string, NormalizedTicker> = new Map()

  /**
   * 가격 업데이트
   */
  updatePrice(ticker: NormalizedTicker): void {
    const { symbol, exchange, marketType } = ticker
    const key = `${symbol}-${exchange}-${marketType}`

    // 전역 제외 심볼 체크
    if (GLOBALLY_EXCLUDED_SYMBOLS.includes(symbol)) {
      return // 무시
    }

    // 거래소별 제외 심볼 체크
    if (EXCLUDED_SYMBOLS[exchange]?.includes(symbol)) {
      return // 무시
    }

    // 이상치 필터링: 동일 심볼의 다른 거래소 가격과 비교
    const existingPrices = this.getPricesForSymbol(symbol)
    if (existingPrices.length > 0) {
      const avgPrice = existingPrices.reduce((sum, p) => sum + p.last, 0) / existingPrices.length
      const diff = Math.abs(ticker.last - avgPrice) / avgPrice

      // 평균 가격과 500% 이상 차이나면 제외 (심볼 충돌 가능성)
      if (diff > 5) {
        console.log(`[PriceService] 이상치 제외: ${key} ₩${ticker.last.toLocaleString()} (평균: ₩${avgPrice.toLocaleString()})`)
        return
      }
    }

    this.prices.set(key, ticker)

    // 로그는 1% 확률로만
    if (Math.random() < 0.01) {
      console.log(`[PriceService] ${key}: ₩${ticker.last.toLocaleString()}`)
    }
  }

  /**
   * 특정 심볼의 모든 가격 조회
   */
  private getPricesForSymbol(symbol: string): NormalizedTicker[] {
    const result: NormalizedTicker[] = []
    this.prices.forEach((ticker) => {
      if (ticker.symbol === symbol) {
        result.push(ticker)
      }
    })
    return result
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