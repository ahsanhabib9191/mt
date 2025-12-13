import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion'

export interface ProductShowcaseProps {
  productImage: string
  headline: string
  primaryText: string
  brandColor: string
  ctaText: string
}

export const ProductShowcase: React.FC<ProductShowcaseProps> = ({
  productImage,
  headline,
  primaryText,
  brandColor,
  ctaText,
}) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  const imageScale = spring({
    frame,
    fps,
    from: 0.8,
    to: 1,
    durationInFrames: 30,
  })

  const imageZoom = interpolate(
    frame,
    [30, durationInFrames - 30],
    [1, 1.15],
    { extrapolateRight: 'clamp' }
  )

  const headlineOpacity = interpolate(
    frame,
    [15, 30],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  const headlineY = interpolate(
    frame,
    [15, 30],
    [30, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  const textOpacity = interpolate(
    frame,
    [35, 50],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  const ctaScale = spring({
    frame: frame - 60,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 20,
  })

  const ctaPulse = interpolate(
    frame,
    [90, 100, 110, 120],
    [1, 1.05, 1, 1.05],
    { extrapolateRight: 'clamp' }
  )

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${imageScale * imageZoom})`,
          width: '70%',
          height: '70%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {productImage ? (
          <img
            src={productImage}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: 16,
            }}
          />
        ) : (
          <div
            style={{
              width: 300,
              height: 300,
              backgroundColor: brandColor,
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 80,
            }}
          >
            📦
          </div>
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 180,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: headlineOpacity,
          transform: `translateY(${headlineY}px)`,
        }}
      >
        <h1
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: 'white',
            textShadow: '0 4px 20px rgba(0,0,0,0.8)',
            margin: 0,
            padding: '0 40px',
          }}
        >
          {headline}
        </h1>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 130,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: textOpacity,
        }}
      >
        <p
          style={{
            fontSize: 28,
            color: 'rgba(255,255,255,0.8)',
            margin: 0,
            padding: '0 60px',
          }}
        >
          {primaryText}
        </p>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 50,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          transform: `scale(${ctaScale * ctaPulse})`,
        }}
      >
        <div
          style={{
            backgroundColor: brandColor,
            color: '#0a0a0a',
            fontSize: 24,
            fontWeight: 700,
            padding: '16px 48px',
            borderRadius: 50,
          }}
        >
          {ctaText}
        </div>
      </div>
    </AbsoluteFill>
  )
}
