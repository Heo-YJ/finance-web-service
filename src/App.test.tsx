import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('입력 폼과 기본 계산 결과를 함께 렌더링한다', () => {
    const markup = renderToStaticMarkup(<App />)

    expect(markup).toContain('이번 달 기준을 알려주세요')
    expect(markup).toContain('이렇게 나누어 보세요')
    expect(markup).toContain('291,667원')
    expect(markup).toContain('1,208,333원')
    expect(markup).toContain('계산 기준과 출처')
  })

  it('CMA와 ISA의 역할 및 CMA 유형 안내를 렌더링한다', () => {
    const markup = renderToStaticMarkup(<App />)

    expect(markup).toContain('CMA와 ISA, 목적이 달라요')
    expect(markup).toContain('그래서 둘 다 해야 하나요?')
    expect(markup).toContain('RP형·MMF형·MMW형의 차이')
    expect(markup).toContain('예금자보호 대상 아님')
    expect(markup).toContain('금융투자협회 CMA 모범규준')
  })
})
