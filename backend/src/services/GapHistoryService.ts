// 갭 히스토리 데이터 구조
interface GapHistory {
  symbol: string           // 코인 이름 (예: BTC)
  spread: number          // 갭 퍼센트 (예: 2.5)
  lowExchange: string     // 싼 거래소 (예: binance)
  highExchange: string    // 비싼 거래소 (예: upbit)
  timestamp: number       // 시간 (밀리초)
}

export class GapHistoryService {
  private history: GapHistory[] = []  // 히스토리 저장소 (메모리)
  private maxSize = 10000             // 최대 10,000개까지만 저장

  // 새로운 갭 데이터 추가
  add(gap: GapHistory) {
    this.history.push(gap)
    
    // 10,000개 넘으면 오래된 것 삭제
    if (this.history.length > this.maxSize) {
      this.history = this.history.slice(-this.maxSize)
    }
  }

  // 최근 N개 가져오기
  getRecent(limit = 100): GapHistory[] {
    return this.history.slice(-limit)
  }

  // 특정 코인의 히스토리 가져오기
  getBySymbol(symbol: string, limit = 100): GapHistory[] {
    return this.history
      .filter(h => h.symbol === symbol)
      .slice(-limit)
  }

  // 전체 개수
  getCount(): number {
    return this.history.length
  }
}