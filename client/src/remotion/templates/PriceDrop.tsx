import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion'

export interface PriceDropProps {
  productImage: string
  productName: string
  originalPrice: string
  salePrice: string
  brandColor: string
  ctaText: string
}

export const PriceDrop: React.FC<PriceDropProps> = ({
  productImage,
  productName,
  originalPrice,
  salePrice,
  brandColor,
  ctaText,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const imageScale = spring({
    frame,
    fps,
    from: 0.5,
    to: 1,
    durationInFrames: 25,
  })

  const productNameOpacity = interpolate(
    frame,
    [20, 35],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  const originalPriceOpacity = interpolate(
    frame,
    [35, 45],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  const strikeProgress = interpolate(
    frame,
    [50, 60],
    [0, 100],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  const salePriceScale = spring({
    frame: frame - 55,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 20,
  })

  const salePriceBounce = interpolate(
    frame,
    [75, 80, 85, 90],
    [1, 1.1, 1, 1.05],
    { extrapolateRight: 'clamp' }
  )

  const ctaOpacity = interpolate(
    frame,
    [85, 95],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <div
        style={{
          position: 'absolute',
          top: 80,
          left: '50%',
          transform: `translateX(-50%) scale(${imageScale})`,
          width: '60%',
          height: '50%',
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
              width: 250,
              height: 250,
              backgroundColor: brandColor,
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 70,
            }}
          >
            🏷️
          </div>
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          top: '55%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: productNameOpacity,
        }}
      >
        <h2
          style={{
            fontSize: 42,
            fontWeight: 700,
            color: 'white',
            margin: 0,
          }}
        >
          {productName}
        </h2>
      </div>

      <div
        style={{
          position: 'absolute',
          top: '65%',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 30,
        }}
      >
        <div
          style={{
            position: 'relative',
            opacity: originalPriceOpacity,
          }}
        >
          <span
            style={{
              fontSize: 48,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            {originalPrice}
          </span>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              height: 4,
              width: `${strikeProgress}%`,
              backgroundColor: '#ef4444',
              transform: 'translateY(-50%) rotate(-5deg)',
            }}
          />
        </div>

        <div
          style={{
            transform: `scale(${salePriceScale * salePriceBounce})`,
          }}
        >
          <span
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: brandColor,
              textShadow: `0 0 40px ${brandColor}50`,
            }}
          >
            {salePrice}
          </span>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 80,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: ctaOpacity,
        }}
      >
        <div
          style={{
            backgroundColor: brandColor,
            color: '#0a0a0a',
            fontSize: 28,
            fontWeight: 700,
            padding: '20px 60px',
            borderRadius: 50,
          }}
        >
          {ctaText}
        </div>
      </div>
    </AbsoluteFill>
  )
}
