import axios from 'axios'

interface UpbitMarket {
  market: string           // "KRW-BTC"
  korean_name: string      // "비트코인"
  english_name: string     // "Bitcoin"
}

export class UpbitMarketService {
  private markets: UpbitMarket[] = []
  private krwMarkets: string[] = []

  /**
   * 업비트 전체 마켓 리스트 가져오기
   */
  async fetchMarkets(): Promise<void> {
    try {
      const response = await axios.get<UpbitMarket[]>('https://api.upbit.com/v1/market/all')
      this.markets = response.data

      // KRW 마켓만 필터링
      this.krwMarkets = this.markets
        .filter(m => m.market.startsWith('KRW-'))
        .map(m => m.market)
        .sort()

      console.log(`[UpbitMarketService] ✅ ${this.krwMarkets.length}개 KRW 마켓 로딩 완료`)
      console.log(`[UpbitMarketService] 예시: ${this.krwMarkets.slice(0, 5).join(', ')}...`)
    } catch (error) {
      console.error('[UpbitMarketService] ❌ 마켓 로딩 실패:', error)
      throw error
    }
  }

  /**
   * KRW 마켓 리스트 반환
   */
  getKrwMarkets(): string[] {
    return this.krwMarkets
  }

  /**
   * 코인 심볼 추출 (KRW-BTC → BTC)
   */
  getSymbols(): string[] {
    return this.krwMarkets.map(market => market.split('-')[1])
  }

  /**
   * 특정 마켓 정보 조회
   */
  getMarketInfo(market: string): UpbitMarket | undefined {
    return this.markets.find(m => m.market === market)
  }
}