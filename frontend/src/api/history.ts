// Backend 서버 URL (환경변수에서 가져옴)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// 갭 히스토리 데이터 타입
export interface GapHistory {
  symbol: string        // 코인 이름 (BTC, ETH 등)
  spread: number        // 갭 퍼센트 (예: 2.5)
  lowExchange: string   // 낮은 가격 거래소
  highExchange: string  // 높은 가격 거래소
  timestamp: number     // 시간 (밀리초)
}

// 특정 코인의 히스토리 가져오기
export const fetchGapHistory = async (
  symbol: string,
  limit: number = 100
): Promise<GapHistory[]> => {
  const response = await fetch(`${API_URL}/api/history/${symbol}?limit=${limit}`)

  if (!response.ok) {
    throw new Error(`히스토리 로딩 실패: ${response.status}`)
  }

  return response.json()
}

// 최근 전체 히스토리 가져오기
export const fetchRecentHistory = async (
  limit: number = 100
): Promise<GapHistory[]> => {
  const response = await fetch(`${API_URL}/api/history/recent?limit=${limit}`)

  if (!response.ok) {
    throw new Error(`최근 히스토리 로딩 실패: ${response.status}`)
  }

  return response.json()
}
