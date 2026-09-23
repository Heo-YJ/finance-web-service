import { describe, expect, it } from 'vitest'
import { DEFAULT_ASSUMPTIONS } from './assumptions'
import { calculateAllocation } from './calculateAllocation'

describe('calculateAllocation', () => {
  it('비상금 부족액을 12개월로 나누어 CMA에 먼저 배정한다', () => {
    const result = calculateAllocation({
      monthlyNetIncome: 3_000_000,
      monthlyEssentialExpense: 1_500_000,
      currentEmergencyFund: 1_000_000,
    })

    expect(result).toEqual({
      monthlyDisposableIncome: 1_500_000,
      emergencyTarget: 4_500_000,
      emergencyGap: 3_500_000,
      allocation: {
        cma: 291_667,
        isa: 1_208_333,
      },
      projectedAnnualIsaContribution: 14_499_996,
      warnings: [],
    })
  })

  it('비상금 목표를 달성했다면 가용액 전부를 ISA에 배정한다', () => {
    const result = calculateAllocation({
      monthlyNetIncome: 3_000_000,
      monthlyEssentialExpense: 1_500_000,
      currentEmergencyFund: 4_500_000,
    })

    expect(result.allocation).toEqual({ cma: 0, isa: 1_500_000 })
    expect(result.emergencyGap).toBe(0)
  })

  it('비상금이 목표를 초과해도 부족액과 CMA 배정액은 음수가 되지 않는다', () => {
    const result = calculateAllocation({
      monthlyNetIncome: 3_000_000,
      monthlyEssentialExpense: 1_500_000,
      currentEmergencyFund: 10_000_000,
    })

    expect(result.emergencyGap).toBe(0)
    expect(result.allocation.cma).toBe(0)
  })

  it('필수지출과 실수령액이 같으면 배정액을 0원으로 처리한다', () => {
    const result = calculateAllocation({
      monthlyNetIncome: 2_000_000,
      monthlyEssentialExpense: 2_000_000,
      currentEmergencyFund: 0,
    })

    expect(result.allocation).toEqual({ cma: 0, isa: 0 })
    expect(result.warnings).toEqual(['NO_DISPOSABLE_INCOME'])
  })

  it('필수지출이 실수령액보다 크면 음수 배정 대신 경고를 반환한다', () => {
    const result = calculateAllocation({
      monthlyNetIncome: 2_000_000,
      monthlyEssentialExpense: 2_500_000,
      currentEmergencyFund: 0,
    })

    expect(result.monthlyDisposableIncome).toBe(0)
    expect(result.allocation).toEqual({ cma: 0, isa: 0 })
    expect(result.warnings).toEqual([
      'EXPENSE_EXCEEDS_INCOME',
      'NO_DISPOSABLE_INCOME',
    ])
  })

  it('월 CMA 필요액이 가용액보다 크면 가용액까지만 배정한다', () => {
    const result = calculateAllocation({
      monthlyNetIncome: 1_100_000,
      monthlyEssentialExpense: 1_000_000,
      currentEmergencyFund: 0,
    })

    expect(result.allocation).toEqual({ cma: 100_000, isa: 0 })
  })

  it('비상금 부족액을 12로 나눈 결과는 원 단위로 올림한다', () => {
    const result = calculateAllocation({
      monthlyNetIncome: 1_000_000,
      monthlyEssentialExpense: 1,
      currentEmergencyFund: 0,
    })

    expect(result.emergencyGap).toBe(3)
    expect(result.allocation.cma).toBe(1)
  })

  it('예상 ISA 연간 배정액이 기본 납입한도를 넘으면 경고한다', () => {
    const result = calculateAllocation({
      monthlyNetIncome: 4_000_000,
      monthlyEssentialExpense: 1_000_000,
      currentEmergencyFund: 3_000_000,
    })

    expect(result.projectedAnnualIsaContribution).toBe(36_000_000)
    expect(result.warnings).toContain('ISA_ANNUAL_LIMIT_EXCEEDED')
  })

  it('실제 잔여 한도가 아니라 주입된 기본 납입한도로 경고를 판단한다', () => {
    const result = calculateAllocation(
      {
        monthlyNetIncome: 2_000_000,
        monthlyEssentialExpense: 1_000_000,
        currentEmergencyFund: 3_000_000,
      },
      {
        ...DEFAULT_ASSUMPTIONS,
        isaAnnualContributionLimit: {
          ...DEFAULT_ASSUMPTIONS.isaAnnualContributionLimit,
          value: 10_000_000,
        },
      },
    )

    expect(result.warnings).toContain('ISA_ANNUAL_LIMIT_EXCEEDED')
  })

  it.each([
    ['monthlyNetIncome', -1, 1_000_000, 0],
    ['monthlyEssentialExpense', 1_000_000, -1, 0],
    ['currentEmergencyFund', 1_000_000, 500_000, Number.NaN],
  ])('%s가 유효하지 않으면 입력 오류를 발생시킨다', (_, income, expense, fund) => {
    expect(() =>
      calculateAllocation({
        monthlyNetIncome: income,
        monthlyEssentialExpense: expense,
        currentEmergencyFund: fund,
      }),
    ).toThrow(RangeError)
  })
})
