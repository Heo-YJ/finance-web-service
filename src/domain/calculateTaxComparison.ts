import { DEFAULT_ASSUMPTIONS } from './assumptions'
import type {
  IsaType,
  ResolvedIsaType,
  SimulationAssumptions,
  TaxAmounts,
  TaxComparisonInput,
  TaxComparisonResult,
  WarningCode,
} from './types'
import {
  assertNonNegativeSafeInteger,
  assertPositiveSafeInteger,
  assertRate,
  assertTaxRate,
} from './validation'

function resolveIsaType(isaType: IsaType): ResolvedIsaType {
  return isaType === 'unknown' ? 'general' : isaType
}

export function calculateTaxAmounts(
  taxableProfit: number,
  isaType: IsaType,
  assumptions: SimulationAssumptions = DEFAULT_ASSUMPTIONS,
): TaxAmounts {
  assertNonNegativeSafeInteger(taxableProfit, 'taxableProfit')
  assertTaxRate(assumptions.normalTaxRate.value, 'normalTaxRate')
  assertTaxRate(assumptions.isaTaxRate.value, 'isaTaxRate')

  const isaTypeUsed = resolveIsaType(isaType)
  const taxFreeLimit = assumptions.isaTaxFreeLimits[isaTypeUsed].value
  assertNonNegativeSafeInteger(taxFreeLimit, 'isaTaxFreeLimit')

  const normalAccountTax = Math.round(
    taxableProfit * assumptions.normalTaxRate.value,
  )
  const isaTaxableProfit = Math.max(taxableProfit - taxFreeLimit, 0)
  const isaTax = Math.round(isaTaxableProfit * assumptions.isaTaxRate.value)
  const taxSaving = Math.max(normalAccountTax - isaTax, 0)
  const warnings: WarningCode[] = []

  if (isaType === 'unknown') {
    warnings.push('ISA_TYPE_DEFAULTED')
  }

  return {
    isaTypeUsed,
    isaTaxableProfit,
    normalAccountTax,
    isaTax,
    taxSaving,
    warnings,
  }
}

export function calculateTaxComparison(
  input: TaxComparisonInput,
  assumptions: SimulationAssumptions = DEFAULT_ASSUMPTIONS,
): TaxComparisonResult {
  assertNonNegativeSafeInteger(
    input.monthlyContribution,
    'monthlyContribution',
  )
  assertPositiveSafeInteger(assumptions.simulationMonths, 'simulationMonths')

  const principal = input.monthlyContribution * assumptions.simulationMonths
  assertNonNegativeSafeInteger(principal, 'principal')

  const annualReturnRate = assumptions.riskAnnualRates[input.riskProfile].value
  assertRate(annualReturnRate, 'annualReturnRate')
  const monthlyReturnRate = Math.pow(1 + annualReturnRate, 1 / 12) - 1
  const monthlySeries = []
  let balance = 0

  for (let month = 1; month <= assumptions.simulationMonths; month += 1) {
    balance = balance * (1 + monthlyReturnRate) + input.monthlyContribution
    const estimatedValue = Math.round(balance)
    assertNonNegativeSafeInteger(estimatedValue, 'estimatedValue')
    monthlySeries.push({
      month,
      principal: input.monthlyContribution * month,
      estimatedValue,
    })
  }

  const estimatedValue = Math.round(balance)
  const taxableProfit = Math.max(estimatedValue - principal, 0)
  const taxAmounts = calculateTaxAmounts(
    taxableProfit,
    input.isaType,
    assumptions,
  )

  return {
    isaTypeUsed: taxAmounts.isaTypeUsed,
    annualReturnRate,
    principal,
    estimatedValue,
    taxableProfit,
    isaTaxableProfit: taxAmounts.isaTaxableProfit,
    normalAccountTax: taxAmounts.normalAccountTax,
    isaTax: taxAmounts.isaTax,
    taxSaving: taxAmounts.taxSaving,
    monthlySeries,
    warnings: taxAmounts.warnings,
  }
}
