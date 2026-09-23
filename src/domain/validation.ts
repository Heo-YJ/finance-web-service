function formatFieldName(fieldName: string) {
  return `Invalid ${fieldName}`
}

export function assertNonNegativeSafeInteger(
  value: number,
  fieldName: string,
) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(
      `${formatFieldName(fieldName)}: expected a non-negative safe integer`,
    )
  }
}

export function assertRate(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value <= -1) {
    throw new RangeError(
      `${formatFieldName(fieldName)}: expected a finite rate greater than -100%`,
    )
  }
}

export function assertTaxRate(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(
      `${formatFieldName(fieldName)}: expected a rate between 0% and 100%`,
    )
  }
}

export function assertPositiveSafeInteger(value: number, fieldName: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(
      `${formatFieldName(fieldName)}: expected a positive safe integer`,
    )
  }
}
