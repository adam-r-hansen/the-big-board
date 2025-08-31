'use client'
import { useState, useEffect } from 'react'

type Props = {
  src?: string | null
  alt?: string
  className?: string
  /** Either use size, or width/height; width/height take precedence if provided */
  size?: number
  width?: number
  height?: number
}

export default function ImgWithFallback({
  src,
  alt = 'Team',
  className = 'h-5 w-5 object-contain',
  size = 20,
  width,
  height,
}: Props) {
  const [url, setUrl] = useState<string | null>(src && src.length > 4 ? src : null)
  useEffect(() => { setUrl(src && src.length > 4 ? src : null) }, [src])
  const w = width ?? size
  const h = height ?? size
  return (
    <img
      src={url ?? '/team-placeholder.svg'}
      alt={alt}
      width={w}
      height={h}
      className={className}
      onError={() => setUrl('/team-placeholder.svg')}
    />
  )
}
