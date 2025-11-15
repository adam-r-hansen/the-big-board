type Team = {
  id: string
  name: string
  short_name: string
  abbreviation: string
  logo: string
  color_primary: string
  color_secondary?: string
  color_pref_light?: string | null
  color_pref_dark?: string | null
}

/**
 * Determines the variant of TeamCard to use based on context
 */
export function getTeamCardVariant(
  context: 'picks' | 'other',
  isPicked: boolean = false,
  isAlreadyUsed: boolean = false
): 'hollow' | 'solid' | 'greyscale' {
  if (context === 'picks') {
    if (isAlreadyUsed) return 'greyscale'
    if (isPicked) return 'solid'
    return 'hollow'
  }
  
  // All other pages always use solid
  return 'solid'
}

/**
 * Determines the display text based on context
 */
export function getTeamCardDisplayText(
  context: 'main' | 'sidebar' | 'mobile'
): 'full' | 'short' | 'abbreviation' {
  switch (context) {
    case 'main':
      return 'full'
    case 'sidebar':
      return 'abbreviation'
    case 'mobile':
      return 'short'
    default:
      return 'full'
  }
}

/**
 * Get team color based on dark mode preference
 */
export function getTeamColor(team: Team, isDarkMode: boolean): string {
  if (isDarkMode) {
    return team.color_pref_dark || team.color_primary
  }
  return team.color_pref_light || team.color_primary
}
