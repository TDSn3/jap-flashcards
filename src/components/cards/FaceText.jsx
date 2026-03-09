export function FaceText({
  primary,
  secondary,
  mode,
  primaryFont,
  primarySize,
  secondaryFont,
  secondarySize,
  primaryColor,
  secondaryColor,
  align = 'center',
}) {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: subText ? 10 : 0, alignItems: align === 'center' ? 'center' : 'flex-start', textAlign: align }}>
      <div style={{ fontFamily: primaryFont, fontSize: primarySize, fontWeight: 600, color: primaryColor, lineHeight: 1.2 }}>{mainText}</div>
      {subText && (
        <div style={{ fontFamily: secondaryFont || primaryFont, fontSize: secondarySize || primarySize * 0.5, fontWeight: 500, color: secondaryColor || primaryColor, lineHeight: 1.35, opacity: 0.72 }}>
          {subText}
        </div>
      )}
    </div>
  )
}
