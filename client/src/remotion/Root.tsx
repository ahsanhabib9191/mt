import { Composition } from 'remotion'
import { ProductShowcase } from './templates/ProductShowcase'
import type { ProductShowcaseProps } from './templates/ProductShowcase'
import { PriceDrop } from './templates/PriceDrop'
import type { PriceDropProps } from './templates/PriceDrop'
import { Testimonial } from './templates/Testimonial'
import type { TestimonialProps } from './templates/Testimonial'

export const Root = () => {
  return (
    <>
      <Composition
        id="ProductShowcase"
        component={ProductShowcase}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={{
          productImage: '',
          headline: 'Your Product',
          primaryText: 'Amazing features await',
          brandColor: '#13ec80',
          ctaText: 'Shop Now',
        } as ProductShowcaseProps}
      />
      <Composition
        id="PriceDrop"
        component={PriceDrop}
        durationInFrames={120}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={{
          productImage: '',
          productName: 'Product Name',
          originalPrice: '$99',
          salePrice: '$49',
          brandColor: '#13ec80',
          ctaText: 'Get Offer',
        } as PriceDropProps}
      />
      <Composition
        id="Testimonial"
        component={Testimonial}
        durationInFrames={180}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={{
          productImage: '',
          quote: '"This product changed my life!"',
          author: 'Happy Customer',
          brandColor: '#13ec80',
          ctaText: 'Learn More',
        } as TestimonialProps}
      />
    </>
  )
}
