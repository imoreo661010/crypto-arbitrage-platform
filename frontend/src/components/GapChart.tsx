import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { fetchGapHistory, GapHistory } from '../api/history'

interface GapChartProps {
  symbol: string       // 조회할 코인 (BTC, ETH 등)
  onClose: () => void  // 모달 닫기 함수
}

export const GapChart = ({ symbol, onClose }: GapChartProps) => {
  // 상태: 히스토리 데이터, 로딩 여부, 에러 메시지
  const [history, setHistory] = useState<GapHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 컴포넌트가 열릴 때 히스토리 데이터 로딩
  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true)
      setError(null)

      try {
        // 최근 100개 데이터 요청
        const data = await fetchGapHistory(symbol, 100)
        setHistory(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류')
      } finally {
        setLoading(false)
      }
    }

    loadHistory()
  }, [symbol])

  // 통계 계산 (최고, 평균, 현재 갭)
  const stats = {
    maxGap: history.length > 0 ? Math.max(...history.map(h => h.spread)) : 0,
    avgGap: history.length > 0 ? history.reduce((sum, h) => sum + h.spread, 0) / history.length : 0,
    currentGap: history.length > 0 ? history[history.length - 1].spread : 0
  }

  // 차트용 데이터 변환 (시간 포맷팅)
  const chartData = history.map(h => ({
    time: new Date(h.timestamp).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    }),
    gap: h.spread,
    fullTime: new Date(h.timestamp).toLocaleString('ko-KR')
  }))

  return (
    // 배경 오버레이 (클릭하면 닫힘)
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      {/* 모달 내용 (클릭해도 안 닫힘) */}
      <div
        className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">{symbol} 갭 히스토리</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            x
          </button>
        </div>

        {/* 로딩 상태 */}
        {loading && (
          <div className="text-center py-10">
            <div className="text-xl">로딩 중...</div>
            <div className="text-gray-400 text-sm mt-2">
              서버가 슬립 상태면 30초 정도 걸릴 수 있어요
            </div>
          </div>
        )}

        {/* 에러 상태 */}
        {error && (
          <div className="text-center py-10">
            <div className="text-red-400">{error}</div>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 데이터 없음 */}
        {!loading && !error && history.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <div className="text-xl mb-2">히스토리 데이터가 없습니다</div>
            <div className="text-sm">
              서버가 시작된 후 1분마다 데이터가 쌓여요.
              <br />
              조금만 기다려 주세요!
            </div>
          </div>
        )}

        {/* 데이터 있음 - 통계 + 차트 */}
        {!loading && !error && history.length > 0 && (
          <>
            {/* 통계 카드 3개 */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-700 p-4 rounded">
                <div className="text-sm text-gray-400">최고 갭</div>
                <div className="text-2xl font-bold text-red-400">
                  {stats.maxGap.toFixed(2)}%
                </div>
              </div>
              <div className="bg-gray-700 p-4 rounded">
                <div className="text-sm text-gray-400">평균 갭</div>
                <div className="text-2xl font-bold text-yellow-400">
                  {stats.avgGap.toFixed(2)}%
                </div>
              </div>
              <div className="bg-gray-700 p-4 rounded">
                <div className="text-sm text-gray-400">현재 갭</div>
                <div className="text-2xl font-bold text-green-400">
                  {stats.currentGap.toFixed(2)}%
                </div>
              </div>
            </div>

            {/* 선 그래프 */}
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} />
                <YAxis stroke="#9CA3AF" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: 'none',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: '#9CA3AF' }}
                  formatter={(value: number) => [`${value.toFixed(2)}%`, '갭']}
                />
                <Line
                  type="monotone"
                  dataKey="gap"
                  stroke="#EF4444"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>

            {/* 하단 정보 */}
            <div className="mt-4 text-sm text-gray-400 text-center">
              데이터 포인트: {history.length}개 |
              기간: 최근 {Math.ceil(history.length)} 분
            </div>
          </>
        )}
      </div>
    </div>
  )
}
