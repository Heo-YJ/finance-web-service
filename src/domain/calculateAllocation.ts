import { DEFAULT_ASSUMPTIONS } from './assumptions'
import type {
  AllocationInput,
  AllocationResult,
  SimulationAssumptions,
  WarningCode,
} from './types'
import {
  assertNonNegativeSafeInteger,
  assertPositiveSafeInteger,
} from './validation'

function validateInput(input: AllocationInput) {
  assertNonNegativeSafeInteger(input.monthlyNetIncome, 'monthlyNetIncome')
  assertNonNegativeSafeInteger(
    input.monthlyEssentialExpense,
    'monthlyEssentialExpense',
  )
  assertNonNegativeSafeInteger(
    input.currentEmergencyFund,
    'currentEmergencyFund',
  )
}

export function calculateAllocation(
  input: AllocationInput,
  assumptions: SimulationAssumptions = DEFAULT_ASSUMPTIONS,
): AllocationResult {
  validateInput(input)
  assertPositiveSafeInteger(
    assumptions.emergencyFundMonths,
    'emergencyFundMonths',
  )
  assertNonNegativeSafeInteger(
    assumptions.isaAnnualContributionLimit.value,
    'isaAnnualContributionLimit',
  )

  const monthlyDisposableIncome = Math.max(
    input.monthlyNetIncome - input.monthlyEssentialExpense,
    0,
  )
  const emergencyTarget =
    input.monthlyEssentialExpense * assumptions.emergencyFundMonths

  if (!Number.isSafeInteger(emergencyTarget)) {
    throw new RangeError('Invalid emergencyTarget: exceeds safe integer range')
  }

  const emergencyGap = Math.max(
    emergencyTarget - input.currentEmergencyFund,
    0,
  )
  const monthlyCmaNeed = Math.ceil(emergencyGap / 12)
  const cma = Math.min(monthlyDisposableIncome, monthlyCmaNeed)
  const isa = monthlyDisposableIncome - cma
  const projectedAnnualIsaContribution = isa * 12

  if (!Number.isSafeInteger(projectedAnnualIsaContribution)) {
    throw new RangeError(
      'Invalid projectedAnnualIsaContribution: exceeds safe integer range',
    )
  }

  const warnings: WarningCode[] = []

  if (input.monthlyEssentialExpense > input.monthlyNetIncome) {
    warnings.push('EXPENSE_EXCEEDS_INCOME')
  }
  if (monthlyDisposableIncome === 0) {
    warnings.push('NO_DISPOSABLE_INCOME')
  }
  if (
    projectedAnnualIsaContribution >
    assumptions.isaAnnualContributionLimit.value
  ) {
    warnings.push('ISA_ANNUAL_LIMIT_EXCEEDED')
  }

  return {
    monthlyDisposableIncome,
    emergencyTarget,
    emergencyGap,
    allocation: { cma, isa },
    projectedAnnualIsaContribution,
    warnings,
  }
}
