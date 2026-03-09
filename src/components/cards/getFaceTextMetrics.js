export function getFaceTextMetrics(primary, secondary, mode, primarySize, secondarySize) {
  const trimmedPrimary = (primary || '').trim()
  const trimmedSecondary = (secondary || '').trim()
  const showSecondaryOnly = mode === 'secondary' && trimmedSecondary
  const showSecondaryFirst = mode === 'secondary-first' && trimmedSecondary
  const mainText = showSecondaryOnly || showSecondaryFirst ? trimmedSecondary : trimmedPrimary
  const subText = mode === 'both'
    ? trimmedSecondary
    : showSecondaryFirst
      ? trimmedPrimary
      : ''

  const mainHeight = mainText ? primarySize * 1.2 : 0
  const subHeight = subText ? 10 + (secondarySize || primarySize * 0.5) * 1.35 : 0

  return mainHeight + subHeight
}
