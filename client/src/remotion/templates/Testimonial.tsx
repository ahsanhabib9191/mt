import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion'

export interface TestimonialProps {
  productImage: string
  quote: string
  author: string
  brandColor: string
  ctaText: string
}

export const Testimonial: React.FC<TestimonialProps> = ({
  productImage,
  quote,
  author,
  brandColor,
  ctaText,
}) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  const bgScale = interpolate(
    frame,
    [0, durationInFrames],
    [1, 1.1],
    { extrapolateRight: 'clamp' }
  )

  const quoteOpacity = interpolate(
    frame,
    [20, 40],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  const quoteY = interpolate(
    frame,
    [20, 40],
    [40, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  const authorOpacity = interpolate(
    frame,
    [50, 65],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  const productScale = spring({
    frame: frame - 70,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 25,
  })

  const ctaScale = spring({
    frame: frame - 120,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 20,
  })

  const starOpacity = interpolate(
    frame,
    [80, 95],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at center, ${brandColor}15 0%, transparent 70%)`,
          transform: `scale(${bgScale})`,
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 80,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: starOpacity,
        }}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            style={{
              fontSize: 40,
              color: '#fbbf24',
              marginRight: 8,
            }}
          >
            ★
          </span>
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          top: 160,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: quoteOpacity,
          transform: `translateY(${quoteY}px)`,
          padding: '0 60px',
        }}
      >
        <p
          style={{
            fontSize: 44,
            fontWeight: 600,
            color: 'white',
            fontStyle: 'italic',
            lineHeight: 1.4,
            margin: 0,
          }}
        >
          {quote}
        </p>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 380,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: authorOpacity,
        }}
      >
        <p
          style={{
            fontSize: 24,
            color: brandColor,
            fontWeight: 600,
            margin: 0,
          }}
        >
          — {author}
        </p>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 450,
          left: '50%',
          transform: `translateX(-50%) scale(${productScale})`,
          width: '50%',
          height: '35%',
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
              boxShadow: `0 20px 60px ${brandColor}30`,
            }}
          />
        ) : (
          <div
            style={{
              width: 200,
              height: 200,
              backgroundColor: brandColor,
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 60,
            }}
          >
            ⭐
          </div>
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 60,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          transform: `scale(${ctaScale})`,
        }}
      >
        <div
          style={{
            backgroundColor: brandColor,
            color: '#0a0a0a',
            fontSize: 26,
            fontWeight: 700,
            padding: '18px 56px',
            borderRadius: 50,
          }}
        >
          {ctaText}
        </div>
      </div>
    </AbsoluteFill>
  )
}
