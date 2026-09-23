export type RiskProfile = 'stable' | 'balanced' | 'aggressive'

export type IsaType = 'general' | 'lowIncome' | 'unknown'

export type ResolvedIsaType = Exclude<IsaType, 'unknown'>

export type WarningCode =
  | 'EXPENSE_EXCEEDS_INCOME'
  | 'NO_DISPOSABLE_INCOME'
  | 'ISA_ANNUAL_LIMIT_EXCEEDED'
  | 'ISA_TYPE_DEFAULTED'

export interface FinancialAssumption {
  readonly value: number
  readonly label: string
  readonly category: 'legal' | 'educational'
  readonly asOf: string
  readonly sourceUrl: string | null
  readonly note: string
}

export interface SimulationAssumptions {
  readonly simulationMonths: number
  readonly emergencyFundMonths: number
  readonly riskAnnualRates: Readonly<Record<RiskProfile, FinancialAssumption>>
  readonly cmaAnnualRate: FinancialAssumption
  readonly normalTaxRate: FinancialAssumption
  readonly isaTaxRate: FinancialAssumption
  readonly isaTaxFreeLimits: Readonly<
    Record<ResolvedIsaType, FinancialAssumption>
  >
  readonly isaAnnualContributionLimit: FinancialAssumption
}

export interface SimulationInput {
  readonly monthlyNetIncome: number
  readonly monthlyEssentialExpense: number
  readonly currentEmergencyFund: number
  readonly riskProfile: RiskProfile
  readonly isaType: IsaType
}

export type AllocationInput = Pick<
  SimulationInput,
  'monthlyNetIncome' | 'monthlyEssentialExpense' | 'currentEmergencyFund'
>

export interface AllocationResult {
  readonly monthlyDisposableIncome: number
  readonly emergencyTarget: number
  readonly emergencyGap: number
  readonly allocation: {
    readonly cma: number
    readonly isa: number
  }
  readonly projectedAnnualIsaContribution: number
  readonly warnings: readonly WarningCode[]
}

export interface TaxComparisonInput {
  readonly monthlyContribution: number
  readonly riskProfile: RiskProfile
  readonly isaType: IsaType
}

export interface TaxAmounts {
  readonly isaTypeUsed: ResolvedIsaType
  readonly isaTaxableProfit: number
  readonly normalAccountTax: number
  readonly isaTax: number
  readonly taxSaving: number
  readonly warnings: readonly WarningCode[]
}

export interface MonthlyProjection {
  readonly month: number
  readonly principal: number
  readonly estimatedValue: number
}

export interface TaxComparisonResult {
  readonly isaTypeUsed: ResolvedIsaType
  readonly annualReturnRate: number
  readonly principal: number
  readonly estimatedValue: number
  readonly taxableProfit: number
  readonly isaTaxableProfit: number
  readonly normalAccountTax: number
  readonly isaTax: number
  readonly taxSaving: number
  readonly monthlySeries: readonly MonthlyProjection[]
  readonly warnings: readonly WarningCode[]
}
