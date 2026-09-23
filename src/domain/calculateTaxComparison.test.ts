import { describe, expect, it } from 'vitest'
import { DEFAULT_ASSUMPTIONS } from './assumptions'
import {
  calculateTaxAmounts,
  calculateTaxComparison,
} from './calculateTaxComparison'

function assumptionsWithStableRate(rate: number) {
  return {
    ...DEFAULT_ASSUMPTIONS,
    riskAnnualRates: {
      ...DEFAULT_ASSUMPTIONS.riskAnnualRates,
      stable: {
        ...DEFAULT_ASSUMPTIONS.riskAnnualRates.stable,
        value: rate,
      },
    },
  }
}

describe('calculateTaxComparison', () => {
  it('월 납입액이 0원이면 원금·수익·세금이 모두 0원이다', () => {
    const result = calculateTaxComparison({
      monthlyContribution: 0,
      riskProfile: 'stable',
      isaType: 'general',
    })

    expect(result.principal).toBe(0)
    expect(result.estimatedValue).toBe(0)
    expect(result.taxableProfit).toBe(0)
    expect(result.normalAccountTax).toBe(0)
    expect(result.isaTax).toBe(0)
  })

  it('수익률이 0%이면 평가액은 원금과 같고 세금은 없다', () => {
    const result = calculateTaxComparison(
      {
        monthlyContribution: 100_000,
        riskProfile: 'stable',
        isaType: 'general',
      },
      assumptionsWithStableRate(0),
    )

    expect(result.principal).toBe(3_600_000)
    expect(result.estimatedValue).toBe(3_600_000)
    expect(result.taxableProfit).toBe(0)
    expect(result.normalAccountTax).toBe(0)
    expect(result.isaTax).toBe(0)
  })

  it('손실 시나리오에서는 과세 대상 수익과 세금을 0원으로 제한한다', () => {
    const result = calculateTaxComparison(
      {
        monthlyContribution: 100_000,
        riskProfile: 'stable',
        isaType: 'general',
      },
      assumptionsWithStableRate(-0.1),
    )

    expect(result.estimatedValue).toBeLessThan(result.principal)
    expect(result.taxableProfit).toBe(0)
    expect(result.normalAccountTax).toBe(0)
    expect(result.isaTax).toBe(0)
  })

  it('ISA 유형 미선택 시 일반형으로 보수적으로 계산한다', () => {
    const result = calculateTaxComparison({
      monthlyContribution: 1_000_000,
      riskProfile: 'aggressive',
      isaType: 'unknown',
    })

    expect(result.isaTypeUsed).toBe('general')
    expect(result.warnings).toEqual(['ISA_TYPE_DEFAULTED'])
  })

  it('36개월의 월별 원금과 평가액 시계열을 만든다', () => {
    const result = calculateTaxComparison({
      monthlyContribution: 100_000,
      riskProfile: 'balanced',
      isaType: 'general',
    })

    expect(result.monthlySeries).toHaveLength(36)
    expect(result.monthlySeries[0]).toEqual({
      month: 1,
      principal: 100_000,
      estimatedValue: 100_000,
    })
    expect(result.monthlySeries[35]?.principal).toBe(3_600_000)
  })

  it('같은 입력은 항상 같은 결과를 반환한다', () => {
    const input = {
      monthlyContribution: 350_000,
      riskProfile: 'balanced' as const,
      isaType: 'lowIncome' as const,
    }

    expect(calculateTaxComparison(input)).toEqual(calculateTaxComparison(input))
  })

  it('음수 또는 정수가 아닌 월 납입액은 거부한다', () => {
    expect(() =>
      calculateTaxComparison({
        monthlyContribution: -1,
        riskProfile: 'stable',
        isaType: 'general',
      }),
    ).toThrow(RangeError)

    expect(() =>
      calculateTaxComparison({
        monthlyContribution: 1.5,
        riskProfile: 'stable',
        isaType: 'general',
      }),
    ).toThrow(RangeError)
  })
})

describe('calculateTaxAmounts', () => {
  it('일반형 비과세 한도 직전과 한도에서는 ISA 과세 대상이 없다', () => {
    expect(calculateTaxAmounts(1_999_999, 'general').isaTaxableProfit).toBe(0)
    expect(calculateTaxAmounts(2_000_000, 'general').isaTaxableProfit).toBe(0)
  })

  it('일반형 비과세 한도 직후부터 초과 수익을 과세 대상으로 잡는다', () => {
    const result = calculateTaxAmounts(2_000_001, 'general')

    expect(result.isaTaxableProfit).toBe(1)
    expect(result.isaTax).toBe(0)
  })

  it('서민형 비과세 한도 직전과 한도에서는 ISA 과세 대상이 없다', () => {
    expect(calculateTaxAmounts(3_999_999, 'lowIncome').isaTaxableProfit).toBe(0)
    expect(calculateTaxAmounts(4_000_000, 'lowIncome').isaTaxableProfit).toBe(0)
  })

  it('서민형 비과세 한도 직후부터 초과 수익을 과세 대상으로 잡는다', () => {
    const result = calculateTaxAmounts(4_000_001, 'lowIncome')

    expect(result.isaTaxableProfit).toBe(1)
    expect(result.isaTax).toBe(0)
  })

  it('일반계좌 세금과 ISA 세금을 같은 과세 대상 수익으로 비교한다', () => {
    const result = calculateTaxAmounts(6_000_000, 'general')

    expect(result.normalAccountTax).toBe(924_000)
    expect(result.isaTax).toBe(396_000)
    expect(result.taxSaving).toBe(528_000)
  })

  it('0%보다 작거나 100%보다 큰 세율 가정은 거부한다', () => {
    const invalidAssumptions = {
      ...DEFAULT_ASSUMPTIONS,
      isaTaxRate: {
        ...DEFAULT_ASSUMPTIONS.isaTaxRate,
        value: -0.01,
      },
    }

    expect(() =>
      calculateTaxAmounts(1_000_000, 'general', invalidAssumptions),
    ).toThrow(RangeError)
  })
})
