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
})
