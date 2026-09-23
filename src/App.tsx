import { useRef, useState, type FormEvent } from 'react'
import {
  DEFAULT_ASSUMPTIONS,
  PRODUCT_GUIDE_SOURCES,
  calculateAllocation,
  calculateTaxComparison,
  type AllocationResult,
  type IsaType,
  type MonthlyProjection,
  type RiskProfile,
  type SimulationInput,
  type TaxComparisonResult,
  type WarningCode,
} from './domain'
import './App.css'

const INITIAL_INPUT: SimulationInput = {
  monthlyNetIncome: 3_000_000,
  monthlyEssentialExpense: 1_500_000,
  currentEmergencyFund: 1_000_000,
  riskProfile: 'balanced',
  isaType: 'unknown',
}

const INITIAL_FORM = {
  monthlyNetIncome: String(INITIAL_INPUT.monthlyNetIncome),
  monthlyEssentialExpense: String(INITIAL_INPUT.monthlyEssentialExpense),
  currentEmergencyFund: String(INITIAL_INPUT.currentEmergencyFund),
  riskProfile: INITIAL_INPUT.riskProfile,
  isaType: INITIAL_INPUT.isaType,
}

type FormState = typeof INITIAL_FORM
type MoneyField =
  | 'monthlyNetIncome'
  | 'monthlyEssentialExpense'
  | 'currentEmergencyFund'

interface CalculationResult {
  input: SimulationInput
  allocation: AllocationResult
  tax: TaxComparisonResult
}

const wonFormatter = new Intl.NumberFormat('ko-KR')

function formatWon(value: number) {
  return `${wonFormatter.format(value)}원`
}

function formatShortWon(value: number) {
  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(value % 100_000_000 === 0 ? 0 : 1)}억원`
  }
  if (value >= 10_000) {
    return `${Math.round(value / 10_000).toLocaleString('ko-KR')}만원`
  }
  return formatWon(value)
}

function createResult(input: SimulationInput): CalculationResult {
  const allocation = calculateAllocation(input)
  const tax = calculateTaxComparison({
    monthlyContribution: allocation.allocation.isa,
    riskProfile: input.riskProfile,
    isaType: input.isaType,
  })

  return { input, allocation, tax }
}

function parseMoney(value: string, label: string, mustBePositive = false) {
  const normalized = value.replaceAll(',', '').trim()

  if (!normalized) {
    return { error: `${label}을 입력해 주세요.` }
  }
  if (!/^\d+$/.test(normalized)) {
    return { error: `${label}은 0 이상의 원 단위 숫자로 입력해 주세요.` }
  }

  const parsed = Number(normalized)
  if (!Number.isSafeInteger(parsed)) {
    return { error: `${label}이 입력 가능한 범위를 넘었습니다.` }
  }
  if (mustBePositive && parsed === 0) {
    return { error: `${label}은 0원보다 커야 합니다.` }
  }

  return { value: parsed }
}

const warningMessages: Record<WarningCode, { title: string; body: string }> = {
  EXPENSE_EXCEEDS_INCOME: {
    title: '필수지출이 실수령액보다 많아요',
    body: '먼저 고정비를 조정하거나 부족액을 확인해야 해요. 이번 달 CMA와 ISA 배정액은 0원으로 계산했습니다.',
  },
  NO_DISPOSABLE_INCOME: {
    title: '이번 달 배정 가능한 금액이 없어요',
    body: '월 실수령액에서 필수지출을 뺀 금액이 0원 이하입니다.',
  },
  ISA_ANNUAL_LIMIT_EXCEEDED: {
    title: 'ISA 연간 납입한도를 확인해 주세요',
    body: '현재 배정안을 12개월 유지하면 기본 연간 납입한도 2,000만원을 넘습니다. 이월 한도와 실제 잔여 한도는 금융회사에서 확인해 주세요.',
  },
  ISA_TYPE_DEFAULTED: {
    title: '일반형 ISA 기준으로 계산했어요',
    body: 'ISA 유형을 모름으로 선택해 비과세 한도가 더 낮은 일반형을 적용했습니다. 실제 유형을 확인하면 세후 금액이 달라질 수 있어요.',
  },
}

function MoneyInput({
  id,
  label,
  value,
  hint,
  error,
  onChange,
}: {
  id: MoneyField
  label: string
  value: string
  hint: string
  error?: string
  onChange: (value: string) => void
}) {
  return (
    <div className="field-group">
      <label htmlFor={id}>{label}</label>
      <div className={`money-input ${error ? 'has-error' : ''}`}>
        <input
          id={id}
          name={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
          onChange={(event) => onChange(event.target.value)}
        />
        <span aria-hidden="true">원</span>
      </div>
      {error ? (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      ) : (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  )
}

function GrowthChart({ series }: { series: readonly MonthlyProjection[] }) {
  const width = 720
  const height = 260
  const padding = { top: 24, right: 24, bottom: 38, left: 62 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const maxValue = Math.max(
    ...series.map((point) => Math.max(point.principal, point.estimatedValue)),
    1,
  )

  const x = (month: number) =>
    padding.left + ((month - 1) / Math.max(series.length - 1, 1)) * chartWidth
  const y = (value: number) =>
    padding.top + chartHeight - (value / maxValue) * chartHeight
  const pathFor = (key: 'principal' | 'estimatedValue') =>
    series
      .map(
        (point, index) =>
          `${index === 0 ? 'M' : 'L'} ${x(point.month).toFixed(2)} ${y(point[key]).toFixed(2)}`,
      )
      .join(' ')

  const monthLabels = [1, 12, 24, 36]
  const valueTicks = [0, 0.5, 1]

  return (
    <div className="chart-wrap">
      <svg
        className="growth-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="36개월 동안의 납입 원금과 예상 평가액 변화"
      >
        <title>36개월 적립식 시뮬레이션</title>
        <defs>
          <linearGradient id="value-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2d66f6" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#2d66f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {valueTicks.map((tick) => {
          const tickValue = maxValue * tick
          const tickY = y(tickValue)
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={tickY}
                y2={tickY}
                className="chart-grid-line"
              />
              <text
                x={padding.left - 12}
                y={tickY + 4}
                textAnchor="end"
                className="chart-axis-label"
              >
                {formatShortWon(Math.round(tickValue))}
              </text>
            </g>
          )
        })}
        {monthLabels.map((month) => (
          <text
            key={month}
            x={x(month)}
            y={height - 10}
            textAnchor={month === 1 ? 'start' : month === 36 ? 'end' : 'middle'}
            className="chart-axis-label"
          >
            {month}개월
          </text>
        ))}
        <path
          d={`${pathFor('estimatedValue')} L ${x(36)} ${y(0)} L ${x(1)} ${y(0)} Z`}
          fill="url(#value-area)"
        />
        <path d={pathFor('principal')} className="chart-line principal-line" />
        <path d={pathFor('estimatedValue')} className="chart-line value-line" />
      </svg>
      <div className="chart-legend" aria-hidden="true">
        <span><i className="legend-line principal" />납입 원금</span>
        <span><i className="legend-line value" />예상 평가액</span>
      </div>
    </div>
  )
}

function App() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [errors, setErrors] = useState<Partial<Record<MoneyField, string>>>({})
  const [result, setResult] = useState<CalculationResult>(() =>
    createResult(INITIAL_INPUT),
  )
  const [isDirty, setIsDirty] = useState(false)
  const resultsRef = useRef<HTMLElement>(null)

  const updateMoney = (field: MoneyField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setIsDirty(true)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const income = parseMoney(form.monthlyNetIncome, '월 실수령액', true)
    const expense = parseMoney(form.monthlyEssentialExpense, '월 필수지출')
    const emergencyFund = parseMoney(form.currentEmergencyFund, '현재 비상금')
    const nextErrors: Partial<Record<MoneyField, string>> = {}

    if (income.error) nextErrors.monthlyNetIncome = income.error
    if (expense.error) nextErrors.monthlyEssentialExpense = expense.error
    if (emergencyFund.error) {
      nextErrors.currentEmergencyFund = emergencyFund.error
    }

    if (
      income.value === undefined ||
      expense.value === undefined ||
      emergencyFund.value === undefined
    ) {
      setErrors(nextErrors)
      return
    }

    const input: SimulationInput = {
      monthlyNetIncome: income.value,
      monthlyEssentialExpense: expense.value,
      currentEmergencyFund: emergencyFund.value,
      riskProfile: form.riskProfile,
      isaType: form.isaType,
    }

    setErrors({})
    setResult(createResult(input))
    setIsDirty(false)
    window.requestAnimationFrame(() => {
      resultsRef.current?.focus({ preventScroll: true })
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const resetForm = () => {
    setForm(INITIAL_FORM)
    setErrors({})
    setResult(createResult(INITIAL_INPUT))
    setIsDirty(false)
  }

  const allocation = result.allocation
  const tax = result.tax
  const warnings = Array.from(
    new Set([...allocation.warnings, ...tax.warnings]),
  )
  const incomeForRatio = Math.max(result.input.monthlyNetIncome, 1)
  const essentialRatio = Math.min(
    (result.input.monthlyEssentialExpense / incomeForRatio) * 100,
    100,
  )
  const cmaRatio = (allocation.allocation.cma / incomeForRatio) * 100
  const isaRatio = (allocation.allocation.isa / incomeForRatio) * 100
  const emergencyProgress =
    allocation.emergencyTarget === 0
      ? 100
      : Math.min(
          (result.input.currentEmergencyFund / allocation.emergencyTarget) * 100,
          100,
        )
  const normalTaxRatio = tax.normalAccountTax > 0 ? 100 : 0
  const isaTaxRatio =
    tax.normalAccountTax > 0
      ? Math.min((tax.isaTax / tax.normalAccountTax) * 100, 100)
      : 0
  const activeRate = DEFAULT_ASSUMPTIONS.riskAnnualRates[result.input.riskProfile]

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="월급 배분 가이드 홈">
          <span className="brand-mark" aria-hidden="true">₩</span>
          <span>월급 배분 가이드</span>
        </a>
        <nav aria-label="주요 메뉴">
          <a href="#calculator">계산하기</a>
          <a href="#account-guide">CMA·ISA 알아보기</a>
          <a href="#assumptions">기준과 출처</a>
        </nav>
      </header>

      <main>
        <section className="hero-section" id="top">
          <div className="hero-copy">
            <p className="eyebrow"><span /> 사회초년생을 위한 3분 월급 저축 가이드</p>
            <h1>
              이번 달 월급,
              <br />얼마를 남기고 어디에 넣을까요?
            </h1>
            <p className="hero-description">
              비상금은 부족하지 않게, 투자는 미루지 않게. 현재 상황을 입력하면
              CMA와 같은 현금성 자산과 ISA의 월 배분 근거를 한눈에 보여드려요.
            </p>
            <div className="hero-points" aria-label="서비스 특징">
              <span><b>01</b> 실수령액 기준</span>
              <span><b>02</b> 비상금 상태 반영</span>
              <span><b>03</b> 3년 세금 비교</span>
            </div>
          </div>
          <aside className="hero-note" aria-label="서비스 안내">
            <span className="note-icon" aria-hidden="true">i</span>
            <div>
              <strong>교육용 시뮬레이션이에요</strong>
              <p>실제 상품을 추천하지 않으며, 공개된 가정으로 계산 과정을 설명합니다.</p>
            </div>
          </aside>
        </section>

        <section className="calculator-layout" id="calculator">
          <aside className="form-panel">
            <div className="section-heading compact">
              <span className="step-number">1</span>
              <div>
                <p className="section-kicker">나의 상황 입력</p>
                <h2>이번 달 기준을 알려주세요</h2>
              </div>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <MoneyInput
                id="monthlyNetIncome"
                label="월 실수령액"
                value={form.monthlyNetIncome}
                hint="세금과 4대 보험을 제외한 금액"
                error={errors.monthlyNetIncome}
                onChange={(value) => updateMoney('monthlyNetIncome', value)}
              />
              <MoneyInput
                id="monthlyEssentialExpense"
                label="월 필수지출"
                value={form.monthlyEssentialExpense}
                hint="월세, 식비, 교통비 등 꼭 필요한 지출"
                error={errors.monthlyEssentialExpense}
                onChange={(value) =>
                  updateMoney('monthlyEssentialExpense', value)
                }
              />
              <MoneyInput
                id="currentEmergencyFund"
                label="현재 비상금"
                value={form.currentEmergencyFund}
                hint="바로 사용할 수 있는 현금성 자산"
                error={errors.currentEmergencyFund}
                onChange={(value) => updateMoney('currentEmergencyFund', value)}
              />

              <fieldset className="choice-fieldset">
                <legend>투자 성향</legend>
                <p>수익률 시나리오에만 반영돼요.</p>
                <div className="choice-grid three-columns">
                  {([
                    ['stable', '안정형', '연 2%'],
                    ['balanced', '중립형', '연 5%'],
                    ['aggressive', '적극형', '연 8%'],
                  ] as const).map(([value, label, description]) => (
                    <label className="choice-card" key={value}>
                      <input
                        type="radio"
                        name="riskProfile"
                        value={value}
                        checked={form.riskProfile === value}
                        onChange={() => {
                          setForm((current) => ({
                            ...current,
                            riskProfile: value as RiskProfile,
                          }))
                          setIsDirty(true)
                        }}
                      />
                      <span>{label}<small>{description}</small></span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="choice-fieldset">
                <legend>ISA 유형</legend>
                <p>금융회사에서 확인한 유형을 선택해 주세요.</p>
                <div className="choice-grid three-columns">
                  {([
                    ['general', '일반형', '200만원'],
                    ['lowIncome', '서민형', '400만원'],
                    ['unknown', '잘 모르겠어요', '일반형 적용'],
                  ] as const).map(([value, label, description]) => (
                    <label className="choice-card" key={value}>
                      <input
                        type="radio"
                        name="isaType"
                        value={value}
                        checked={form.isaType === value}
                        onChange={() => {
                          setForm((current) => ({
                            ...current,
                            isaType: value as IsaType,
                          }))
                          setIsDirty(true)
                        }}
                      />
                      <span>{label}<small>{description}</small></span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {isDirty && (
                <p className="dirty-notice" role="status">
                  입력이 변경됐어요. 다시 계산하면 결과에 반영됩니다.
                </p>
              )}

              <div className="form-actions">
                <button className="primary-button" type="submit">
                  내 월급 배분 계산하기 <span aria-hidden="true">→</span>
                </button>
                <button className="text-button" type="button" onClick={resetForm}>
                  예시값으로 초기화
                </button>
              </div>
            </form>
          </aside>

          <section className="results-panel" ref={resultsRef} tabIndex={-1}>
            <div className="section-heading">
              <span className="step-number">2</span>
              <div>
                <p className="section-kicker">이번 달 가이드</p>
                <h2>이렇게 나누어 보세요</h2>
                <p>입력한 금액과 공개된 가정을 바탕으로 계산했어요.</p>
              </div>
              <span className="result-badge">
                {result.input.isaType === 'lowIncome' ? '서민형' : '일반형'} 기준
              </span>
            </div>

            <div className="allocation-cards">
              <article className="allocation-card essential">
                <div className="card-topline"><span className="card-dot" />필수지출</div>
                <strong>{formatWon(result.input.monthlyEssentialExpense)}</strong>
                <p>먼저 확보할 생활비</p>
              </article>
              <article className="allocation-card cma">
                <div className="card-topline"><span className="card-dot" />비상금 · CMA 등</div>
                <strong>{formatWon(allocation.allocation.cma)}</strong>
                <p>비상금 목표를 위한 월 적립</p>
              </article>
              <article className="allocation-card isa">
                <div className="card-topline"><span className="card-dot" />ISA</div>
                <strong>{formatWon(allocation.allocation.isa)}</strong>
                <p>장기 투자를 위한 월 배정</p>
              </article>
            </div>

            <article className="content-card allocation-overview">
              <div className="card-heading-row">
                <div>
                  <p className="card-eyebrow">월급 배분</p>
                  <h3>실수령액 안에서 우선순위를 정했어요</h3>
                </div>
                <strong>{formatWon(result.input.monthlyNetIncome)}</strong>
              </div>
              <div className="allocation-bar" aria-label="필수지출, 비상금용 CMA 등, ISA 월급 배분 비율">
                <span className="essential" style={{ width: `${essentialRatio}%` }} />
                <span className="cma" style={{ width: `${cmaRatio}%` }} />
                <span className="isa" style={{ width: `${isaRatio}%` }} />
              </div>
              <div className="allocation-legend">
                <span><i className="essential" />필수지출 {Math.round(essentialRatio)}%</span>
                <span><i className="cma" />비상금 {Math.round(cmaRatio)}%</span>
                <span><i className="isa" />ISA {Math.round(isaRatio)}%</span>
              </div>
            </article>

            <article className="content-card emergency-card">
              <div className="emergency-copy">
                <p className="card-eyebrow">비상금 목표</p>
                <h3>{formatWon(allocation.emergencyTarget)}</h3>
                <p>필수지출 3개월분을 목표로, 부족액을 12개월에 나눴어요.</p>
              </div>
              <div className="progress-copy">
                <span>현재 {formatWon(result.input.currentEmergencyFund)}</span>
                <strong>{Math.round(emergencyProgress)}%</strong>
              </div>
              <div
                className="progress-track"
                role="progressbar"
                aria-label="비상금 목표 달성률"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(emergencyProgress)}
              >
                <span style={{ width: `${emergencyProgress}%` }} />
              </div>
              <p className="progress-footnote">
                {allocation.emergencyGap > 0
                  ? `목표까지 ${formatWon(allocation.emergencyGap)} 남았어요.`
                  : '비상금 목표를 달성했어요. CMA 추가 배정 없이 ISA에 배정합니다.'}
              </p>
            </article>

            {warnings.length > 0 && (
              <div className="warning-list" aria-live="polite">
                {warnings.map((warning) => (
                  <article className="warning-item" key={warning}>
                    <span aria-hidden="true">!</span>
                    <div>
                      <strong>{warningMessages[warning].title}</strong>
                      <p>{warningMessages[warning].body}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <article className="content-card simulation-card">
              <div className="card-heading-row simulation-heading">
                <div>
                  <p className="card-eyebrow">3년 시뮬레이션</p>
                  <h3>매월 {formatWon(allocation.allocation.isa)}을 투자한다면</h3>
                </div>
                <span className="rate-chip">{activeRate.label} 연 {activeRate.value * 100}%</span>
              </div>
              <div className="simulation-summary">
                <div><span>납입 원금</span><strong>{formatWon(tax.principal)}</strong></div>
                <span className="summary-arrow" aria-hidden="true">→</span>
                <div className="highlight"><span>예상 평가액</span><strong>{formatWon(tax.estimatedValue)}</strong></div>
              </div>
              <GrowthChart series={tax.monthlySeries} />
            </article>

            <article className="content-card tax-card">
              <div className="card-heading-row">
                <div>
                  <p className="card-eyebrow">동일 자산 세금 비교</p>
                  <h3>같은 수익도 계좌에 따라 세후 금액이 달라져요</h3>
                </div>
                <span className="tax-saving">예상 절세 {formatWon(tax.taxSaving)}</span>
              </div>
              <div className="tax-comparison">
                <div className="tax-row">
                  <div className="tax-label"><span>일반계좌</span><strong>{formatWon(tax.normalAccountTax)}</strong></div>
                  <div className="tax-track"><span className="normal" style={{ width: `${normalTaxRatio}%` }} /></div>
                  <small>과세 대상 수익의 15.4%</small>
                </div>
                <div className="tax-row">
                  <div className="tax-label"><span>ISA</span><strong>{formatWon(tax.isaTax)}</strong></div>
                  <div className="tax-track"><span className="isa" style={{ width: `${isaTaxRatio}%` }} /></div>
                  <small>{tax.isaTypeUsed === 'general' ? '200만원' : '400만원'} 비과세 후 초과분 9.9%</small>
                </div>
              </div>
              <p className="tax-note">
                과세 대상 예상 수익 {formatWon(tax.taxableProfit)}을 기준으로 비교했습니다.
                수수료와 해외 원천징수, 상품별 과세 차이는 반영하지 않았어요.
              </p>
            </article>

            <a className="account-guide-link" href="#account-guide">
              CMA와 ISA가 낯설다면 차이부터 확인해 보세요
              <span aria-hidden="true">↓</span>
            </a>
          </section>
        </section>

        <section className="account-guide-section" id="account-guide">
          <div className="section-heading account-guide-heading">
            <span className="step-number">?</span>
            <div>
              <p className="section-kicker">계좌 역할 이해하기</p>
              <h2>CMA와 ISA, 목적이 달라요</h2>
              <p>
                둘 다 해야 하는 것은 아니에요. 지금 필요한 돈과 오래 굴릴 돈을
                구분하기 위한 선택지입니다.
              </p>
            </div>
          </div>

          <div className="account-comparison-grid">
            <article className="account-explainer cma-explainer">
              <div className="account-explainer-heading">
                <span className="account-icon" aria-hidden="true">C</span>
                <div>
                  <h3>CMA</h3>
                  <p>잠깐 세워두는 자금</p>
                </div>
              </div>
              <p className="account-description">
                계좌의 현금을 RP·MMF·MMW 같은 단기 금융상품에 자동으로
                운용하는 자금관리 서비스예요.
              </p>
              <div className="account-use-case">
                <strong>이럴 때</strong>
                <span>비상금이나 월급 대기자금처럼 곧 꺼내 쓸 돈</span>
              </div>
              <p className="account-caution">
                수시입출금이 편리하지만 수익 계산 방식, 손실 가능성,
                예금자보호 여부가 유형별로 달라요.
              </p>
            </article>

            <article className="account-explainer isa-explainer">
              <div className="account-explainer-heading">
                <span className="account-icon" aria-hidden="true">I</span>
                <div>
                  <h3>ISA</h3>
                  <p>오래 굴리는 절세 바구니</p>
                </div>
              </div>
              <p className="account-description">
                예금·펀드·ETF 등을 한 계좌에서 운용하고, 일정 요건을 충족하면
                수익에 대한 세제 혜택을 받을 수 있는 계좌예요.
              </p>
              <div className="account-use-case">
                <strong>이럴 때</strong>
                <span>3년 이상 운용할 수 있는 중장기 투자자금</span>
              </div>
              <p className="account-caution">
                가입 유형에 따라 담을 수 있는 상품이 다르고, 선택한 상품에 따라
                원금 손실이 날 수 있어요.
              </p>
            </article>
          </div>

          <div className="account-answer">
            <strong>그래서 둘 다 해야 하나요?</strong>
            <p>
              아니요. 비상금이 부족하다면 CMA를 포함한 현금성 자산을 먼저
              확보하고, 생활비와 비상금을 제외한 여유자금이 생겼을 때 ISA를
              검토하면 돼요.
            </p>
          </div>

          <details className="cma-types">
            <summary>
              <span>
                <strong>CMA 유형도 알아볼까요?</strong>
                <small>RP형·MMF형·MMW형의 차이</small>
              </span>
              <span className="details-toggle" aria-hidden="true">+</span>
            </summary>
            <div className="cma-type-grid">
              <article>
                <span className="type-label">RP형</span>
                <strong>환매조건부채권에 투자</strong>
                <p>증권사가 정한 약정 수익률을 적용해 상대적으로 이해하기 쉬워요.</p>
                <small>예금자보호 대상 아님 · 증권사 신용위험 확인</small>
              </article>
              <article>
                <span className="type-label">MMF형</span>
                <strong>단기 채권형 펀드에 투자</strong>
                <p>국공채와 우량 단기금융상품의 운용 실적에 따라 수익이 달라져요.</p>
                <small>예금자보호 대상 아님 · 원금 손실 가능</small>
              </article>
              <article>
                <span className="type-label">MMW형</span>
                <strong>랩계약으로 단기자산 운용</strong>
                <p>주로 증권금융 예수금 등 단기자산에 운용하고 실적을 배분해요.</p>
                <small>예금자보호 대상 아님 · 보수와 조건 확인</small>
              </article>
              <article>
                <span className="type-label">참고 · 종금형</span>
                <strong>보호 여부가 다른 예외 유형</strong>
                <p>보호 대상 상품이면 한 금융회사에서 원금과 소정의 이자를 합해 1억원까지 보호될 수 있어요.</p>
                <small>취급 금융회사가 제한적이므로 가입 전 보호 여부 확인</small>
              </article>
            </div>
            <p className="cma-type-note">
              같은 유형도 금융회사마다 수익률, 자동투자 시간, 출금 조건이 달라요.
              특정 유형이 항상 더 좋다는 뜻은 아니며 가입 전 상품설명서를 확인해야 합니다.
            </p>
          </details>

          <div className="account-guide-sources" aria-label="CMA와 ISA 설명 출처">
            <span>확인일 {PRODUCT_GUIDE_SOURCES.cma.asOf}</span>
            <a href={PRODUCT_GUIDE_SOURCES.cma.url} target="_blank" rel="noreferrer">
              {PRODUCT_GUIDE_SOURCES.cma.label} <span aria-hidden="true">↗</span>
            </a>
            <a
              href={PRODUCT_GUIDE_SOURCES.depositProtection.url}
              target="_blank"
              rel="noreferrer"
            >
              {PRODUCT_GUIDE_SOURCES.depositProtection.label} <span aria-hidden="true">↗</span>
            </a>
            <a href={PRODUCT_GUIDE_SOURCES.isa.url} target="_blank" rel="noreferrer">
              {PRODUCT_GUIDE_SOURCES.isa.label} <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>

        <section className="assumptions-section" id="assumptions">
          <div className="section-heading wide">
            <div>
              <p className="section-kicker">계산 기준과 출처</p>
              <h2>숫자보다 근거를 먼저 보여드려요</h2>
              <p>바뀔 수 있는 금융 정보는 기준일과 출처를 함께 관리합니다.</p>
            </div>
            <span className="verified-date">확인일 {DEFAULT_ASSUMPTIONS.isaTaxRate.asOf}</span>
          </div>
          <div className="assumption-grid">
            <article>
              <span>비상금</span>
              <strong>필수지출 3개월분</strong>
              <p>부족액을 12개월 동안 채우는 서비스 정책</p>
            </article>
            <article>
              <span>ISA 비과세</span>
              <strong>일반 200만원 · 서민 400만원</strong>
              <p>초과 순수익에는 9.9% 분리과세 적용</p>
            </article>
            <article>
              <span>연간 납입</span>
              <strong>기본 2,000만원</strong>
              <p>미사용 이월 한도와 실제 잔여 한도는 별도 확인</p>
            </article>
          </div>
          <div className="source-links">
            <a
              href={DEFAULT_ASSUMPTIONS.isaTaxFreeLimits.general.sourceUrl ?? '#'}
              target="_blank"
              rel="noreferrer"
            >
              국가법령정보센터 <span aria-hidden="true">↗</span>
            </a>
            <a
              href={DEFAULT_ASSUMPTIONS.isaAnnualContributionLimit.sourceUrl ?? '#'}
              target="_blank"
              rel="noreferrer"
            >
              기획재정부 <span aria-hidden="true">↗</span>
            </a>
            <a
              href={DEFAULT_ASSUMPTIONS.isaTaxRate.sourceUrl ?? '#'}
              target="_blank"
              rel="noreferrer"
            >
              ISA 세제 안내 <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>

        <section className="disclaimer-section">
          <strong>꼭 확인해 주세요</strong>
          <p>
            본 서비스는 금융상품 가입이나 투자를 권유하지 않는 교육용 계산기입니다.
            표시 금액은 입력값과 단순화된 가정에 따른 예상치이며 실제 수익과 세금은 상품,
            수수료, 거래 시점, 세법 및 금융회사 약관에 따라 달라질 수 있습니다.
          </p>
        </section>
      </main>

      <footer>
        <div className="brand footer-brand">
          <span className="brand-mark" aria-hidden="true">₩</span>
          <span>월급 배분 가이드</span>
        </div>
        <p>처음 받는 월급을, 이해할 수 있는 계획으로.</p>
      </footer>
    </div>
  )
}

export default App
