'use client'

import { useState, useEffect } from 'react'

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

type TeamCardProps = {
  team: Team
  variant: 'hollow' | 'solid' | 'greyscale'
  displayText: 'full' | 'short' | 'abbreviation'
  onClick?: () => void
  disabled?: boolean
  className?: string
}

export default function TeamCard({
  team,
  variant,
  displayText,
  onClick,
  disabled = false,
  className = '',
}: TeamCardProps) {
  const [isDarkMode, setIsDarkMode] = useState(false)

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches)
    }
    
    checkDarkMode()
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', checkDarkMode)
    
    return () => mediaQuery.removeEventListener('change', checkDarkMode)
  }, [])

  // Get the appropriate color based on mode
  const getTeamColor = () => {
    if (isDarkMode) {
      return team.color_pref_dark || team.color_primary
    }
    return team.color_pref_light || team.color_primary
  }

  // Get display text based on prop
  const getDisplayText = () => {
    switch (displayText) {
      case 'full':
        return team.name
      case 'short':
        return team.short_name
      case 'abbreviation':
        return team.abbreviation
      default:
        return team.name
    }
  }

  const teamColor = getTeamColor()
  const text = getDisplayText()

  // Base styles
  const baseStyles = 'rounded-lg transition-all'
  
  // Variant-specific styles
  const variantStyles = {
    hollow: `border-[3px] bg-transparent ${
      disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:shadow-lg hover:scale-105'
    }`,
    solid: 'border-[3px]',
    greyscale: 'border-[3px] bg-transparent cursor-not-allowed opacity-40 grayscale',
  }

  // Click handler
  const handleClick = () => {
    if (!disabled && onClick) {
      onClick()
    }
  }

  return (
    <div
      onClick={handleClick}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      style={{
        borderColor: teamColor,
        backgroundColor: variant === 'solid' ? teamColor : 'transparent',
      }}
    >
      <div className="p-4">
        <div className="flex items-center gap-3">
          {/* Logo with white circular background for solid cards */}
          {variant === 'solid' ? (
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center p-1.5 flex-shrink-0">
              <img
                src={team.logo}
                alt={team.name}
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <img
              src={team.logo}
              alt={team.name}
              className="w-12 h-12 object-contain flex-shrink-0"
            />
          )}
          
          {/* Team name/text */}
          <span
            className={`font-semibold text-lg ${
              variant === 'solid' ? 'text-white' : ''
            }`}
            style={{
              color: variant !== 'solid' ? teamColor : undefined,
            }}
          >
            {text}
          </span>
        </div>
      </div>
    </div>
  )
}
