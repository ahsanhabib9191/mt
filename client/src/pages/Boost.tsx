import { useState, useEffect } from 'react'
import { Player } from '@remotion/player'
import { ProductShowcase } from '../remotion/templates/ProductShowcase'
import { PriceDrop } from '../remotion/templates/PriceDrop'
import { Testimonial } from '../remotion/templates/Testimonial'

type AdFormat = 'image' | 'video'
type VideoTemplate = 'ProductShowcase' | 'PriceDrop' | 'Testimonial'

interface PixelInfo {
  detected: boolean
  pixelId: string | null
  initEvents: string[]
}

interface CreativeIntent {
  websiteType: 'service' | 'luxury_product' | 'ecommerce' | 'content' | 'general'
  suggestedFormat: 'static' | 'interactive' | 'zoom' | 'carousel' | 'video'
  formatReason: string
  previewEffect: 'none' | 'hover_glow' | 'zoom_pulse' | 'carousel_slide' | 'video_play'
}

interface AnalysisResult {
  url: string
  title: string
  description: string
  usp: string
  images: string[]
  brandColors: string[]
  pageSpeed: { score: 'fast' | 'medium' | 'slow'; loadTime: number }
  pixel: PixelInfo
  creativeIntent?: CreativeIntent
  adCopy: Array<{
    headline: string
    primaryText: string
    description: string
    callToAction: string
    angle: string
    hook: string
  }>
  targetAudience: {
    interests: string[]
    ageRange: { min: number; max: number }
    gender: string
    demographics: string[]
  }
  brandVoice: string
  productCategory: string
}

type UserLevel = 'newbie' | 'growing' | 'pro' | 'unknown'

interface PixelAnalysis {
  userLevel: UserLevel
  pixelId?: string
  recommendations: string[]
  recommendedObjective?: string
  smartDefaults?: {
    objective: string
    optimizationGoal: string
    suggestedBudget: number
  }
}

interface ConnectedAccount {
  id: string;
  name: string;
}

type Step = 'input' | 'analyzing' | 'results' | 'creative' | 'targeting' | 'budget' | 'preview' | 'launch' | 'success'

export default function Boost() {
  const [step, setStep] = useState<Step>('input')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanStatus, setScanStatus] = useState('')

  const [selectedHeadline, setSelectedHeadline] = useState(0)
  const [selectedPrimaryText, setSelectedPrimaryText] = useState(0)
  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedCTA, setSelectedCTA] = useState('Learn More')
  const [customHeadline, setCustomHeadline] = useState('')
  const [customPrimaryText, setCustomPrimaryText] = useState('')

  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [ageRange, setAgeRange] = useState({ min: 25, max: 54 })
  const [selectedGender, setSelectedGender] = useState('all')
  const [locations] = useState(['United States'])

  const [dailyBudget, setDailyBudget] = useState(20)
  const [duration, setDuration] = useState(7)

  const [previewPlatform, setPreviewPlatform] = useState<'facebook' | 'instagram'>('facebook')
  const [pixelAnalysis, setPixelAnalysis] = useState<PixelAnalysis | null>(null)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [analysisRevision, setAnalysisRevision] = useState(0)
  const [adFormat, setAdFormat] = useState<AdFormat>('image')
  const [videoTemplate, setVideoTemplate] = useState<VideoTemplate>('ProductShowcase')

  const [connectedAccount, setConnectedAccount] = useState<ConnectedAccount | null>(null)
  const [isLaunching, setIsLaunching] = useState(false)

  useEffect(() => {
    // Check for connected account - "Giant Tech" style: Check Backend, not just localStorage
    const verifyConnection = async () => {
      try {
        // First check if we have a connection for tenant '1' OR 'default_tenant' (seeded)
        // Check 1: Tenant 1 (Normal)
        const res = await fetch('/api/auth/connections?tenantId=1');
        const data = await res.json();
        const connections = data.data || [];

        // Check 2: Default Tenant (Seeded/Dev)
        const resDefault = await fetch('/api/auth/connections?tenantId=default_tenant');
        const dataDefault = await resDefault.json();
        const defaultConnections = dataDefault.data || [];

        const allConnections = [...connections, ...defaultConnections];

        if (allConnections.length > 0) {
          // Prefer active connections
          const activeConn = allConnections.find((c: any) => c.status === 'ACTIVE') || allConnections[0];

          if (activeConn) {
            console.log('Autoconnecting to:', activeConn.adAccountId);
            setConnectedAccount({
              id: activeConn.adAccountId,
              name: 'Meta Ad Account' // Backend doesn't always return name on list, but that's fine for MVP
            });
            return; // Found one, exit
          }
        }
      } catch (e) {
        console.error('Failed to verify connection', e);
      }

      // Fallback: Check localStorage
      const stored = localStorage.getItem('connected_account')
      if (stored) {
        try {
          const data = JSON.parse(stored)
          if (data.availableAccounts && data.availableAccounts.length > 0) {
            setConnectedAccount(data.availableAccounts[0])
          }
        } catch (e) {
          console.error('Failed to parse connection data')
        }
      }
    };

    verifyConnection();
  }, [])

  useEffect(() => {
    setCarouselIndex(0)
    const imageCount = analysis?.images?.length ?? 0
    const maxSlides = Math.min(imageCount, 4)
    if (analysis?.creativeIntent?.previewEffect === 'carousel_slide' && maxSlides > 1) {
      const interval = setInterval(() => {
        setCarouselIndex((prev) => {
          const next = (prev + 1) % maxSlides
          setSelectedImage(next)
          return next
        })
      }, 2500)
      return () => clearInterval(interval)
    }
  }, [analysisRevision, analysis?.creativeIntent?.previewEffect, analysis?.images?.length])

  const handleAnalyze = async () => {
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    try {
      new URL(url)
    } catch {
      setError('Please enter a valid URL')
      return
    }

    setError(null)
    setStep('analyzing')
    setScanProgress(0)

    const scanSteps = [
      'Connecting to website...',
      'Extracting brand colors...',
      'Analyzing content...',
      'Detecting pixel...',
      'Checking page speed...',
      'Generating AI copy...',
      'Finalizing analysis...'
    ]

    let currentStep = 0
    const progressInterval = setInterval(() => {
      currentStep++
      if (currentStep < scanSteps.length) {
        setScanStatus(scanSteps[currentStep])
        setScanProgress(Math.min(90, currentStep * 15))
      }
    }, 800)

    try {
      setScanStatus(scanSteps[0])

      const response = await fetch('/api/boost/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      clearInterval(progressInterval)
      setScanProgress(100)
      setScanStatus('Complete!')

      const data = await response.json()

      if (data.error) {
        setError(data.error)
        setStep('input')
        return
      }

      console.log('Analysis data received:', data)
      setAnalysisRevision((rev) => rev + 1)
      setSelectedImage(0)
      setAnalysis(data)
      setSelectedInterests(data.targetAudience?.interests || [])
      if (data.targetAudience?.ageRange) {
        setAgeRange(data.targetAudience.ageRange)
      }
      setSelectedGender(data.targetAudience?.gender || 'all')

      if (data.smartDefaults) {
        setPixelAnalysis({
          userLevel: data.smartDefaults.userLevel || 'newbie',
          pixelId: data.pixel?.pixelId || undefined,
          recommendations: data.smartDefaults.recommendations || [],
          recommendedObjective: data.smartDefaults.objective,
          smartDefaults: {
            objective: data.smartDefaults.objective,
            optimizationGoal: data.smartDefaults.optimizationGoal,
            suggestedBudget: data.smartDefaults.suggestedBudget
          }
        })

        if (data.smartDefaults.suggestedBudget) {
          setDailyBudget(data.smartDefaults.suggestedBudget)
        }
      } else {
        setPixelAnalysis({
          userLevel: 'newbie',
          recommendations: ['No pixel detected - start with Traffic campaigns', 'Add Meta Pixel to track conversions'],
          smartDefaults: {
            objective: 'TRAFFIC',
            optimizationGoal: 'LINK_CLICKS',
            suggestedBudget: 10
          }
        })
      }

      setTimeout(() => setStep('results'), 500)
    } catch (err) {
      clearInterval(progressInterval)
      setError('Failed to analyze URL. Please try again.')
      setStep('input')
    }
  }

  const ctaOptions = ['Learn More', 'Shop Now', 'Sign Up', 'Get Offer', 'Book Now', 'Contact Us']

  const isCarouselMode = analysis?.creativeIntent?.previewEffect === 'carousel_slide'
  const activeImageIndex = isCarouselMode ? carouselIndex : selectedImage

  const getSpeedColor = (score: string) => {
    if (score === 'fast') return 'text-green-500'
    if (score === 'medium') return 'text-yellow-500'
    return 'text-red-500'
  }

  const getSpeedIcon = (score: string) => {
    if (score === 'fast') return 'check_circle'
    if (score === 'medium') return 'warning'
    return 'error'
  }

  const estimatedReach = dailyBudget * duration * 800 + Math.floor(Math.random() * 5000)
  const estimatedClicks = Math.floor(estimatedReach * 0.02)

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border-light dark:border-border-dark">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 text-primary">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path d="M36.7273 44C33.9891 44 31.6043 39.8386 30.3636 33.69C29.123 39.8386 26.7382 44 24 44C21.2618 44 18.877 39.8386 17.6364 33.69C16.3957 39.8386 14.0109 44 11.2727 44C7.25611 44 4 35.0457 4 24C4 12.9543 7.25611 4 11.2727 4C14.0109 4 16.3957 8.16144 17.6364 14.31C18.877 8.16144 21.2618 4 24 4C26.7382 4 29.123 8.16144 30.3636 14.31C31.6043 8.16144 33.9891 4 36.7273 4C40.7439 4 44 12.9543 44 24C44 35.0457 40.7439 44 36.7273 44Z" fill="currentColor"></path>
            </svg>
          </div>
          <span className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">Shothik.ai</span>
        </div>

        {step !== 'input' && step !== 'analyzing' && step !== 'success' && (
          <div className="flex items-center gap-2">
            {['results', 'creative', 'targeting', 'budget', 'preview', 'launch'].map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${step === s ? 'bg-primary text-background-dark' :
                  ['results', 'creative', 'targeting', 'budget', 'preview', 'launch'].indexOf(step) > i ? 'bg-primary/20 text-primary' :
                    'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark'
                  }`}>
                  {i + 1}
                </div>
                {i < 5 && <div className="w-8 h-0.5 bg-border-light dark:bg-border-dark" />}
              </div>
            ))}
          </div>
        )}

        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary">person</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">

        {step === 'input' && (
          <div className="flex flex-col items-center justify-center min-h-[70vh]">
            <div className="text-center mb-8">
              <h1 className="text-4xl md:text-5xl font-bold text-text-primary-light dark:text-text-primary-dark mb-4">
                See What AI Thinks of Your Business
              </h1>
              <p className="text-lg text-text-secondary-light dark:text-text-secondary-dark">
                Enter your website and watch the magic happen
              </p>
            </div>

            <div className="w-full max-w-xl">
              <div className="relative">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  placeholder="https://www.yourwebsite.com/"
                  className="w-full px-6 py-4 pr-32 rounded-2xl border-2 border-primary/30 bg-surface-light dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark placeholder:text-text-secondary-light/50 dark:placeholder:text-text-secondary-dark/50 focus:border-primary focus:outline-none transition-colors text-lg"
                />
                <button
                  onClick={handleAnalyze}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2.5 rounded-xl bg-primary text-background-dark font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined">search</span>
                  Analyze
                </button>
              </div>

              {error && (
                <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-center">
                  {error}
                </div>
              )}
            </div>

            <div className="mt-12 flex items-center gap-8 text-text-secondary-light dark:text-text-secondary-dark">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">palette</span>
                <span className="text-sm">Brand Colors</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">speed</span>
                <span className="text-sm">Page Speed</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">track_changes</span>
                <span className="text-sm">Pixel Detection</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">auto_awesome</span>
                <span className="text-sm">AI Copy</span>
              </div>
            </div>
          </div>
        )}

        {step === 'analyzing' && (
          <div className="flex flex-col items-center justify-center min-h-[70vh]">
            <div className="w-full max-w-md">
              <div className="relative mb-8">
                <div className="w-32 h-32 mx-auto rounded-full border-4 border-primary/20 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">{scanProgress}%</span>
                </div>
              </div>

              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
                  Analyzing Your Website
                </h2>
                <p className="text-text-secondary-light dark:text-text-secondary-dark animate-pulse">
                  {scanStatus}
                </p>
              </div>

              <div className="w-full bg-surface-light dark:bg-surface-dark rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {step === 'results' && !analysis && (
          <div className="text-center py-12">
            <h3 className="text-xl text-red-500 mb-2">Error loading results</h3>
            <p className="text-text-secondary-light dark:text-text-secondary-dark">The analysis completed but no data was received.</p>
            <button onClick={() => setStep('input')} className="mt-4 text-primary font-medium hover:underline">Try Again</button>
          </div>
        )}

        {step === 'results' && analysis && (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
                We Scanned Your Website
              </h2>
              <p className="text-text-secondary-light dark:text-text-secondary-dark">
                {analysis.url}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-6 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-primary">palette</span>
                  <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">Brand Colors</span>
                </div>
                <div className="flex gap-2">
                  {analysis.brandColors.map((color, i) => (
                    <div
                      key={i}
                      className="w-10 h-10 rounded-lg shadow-inner border border-white/20"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-primary">lightbulb</span>
                  <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">Your USP</span>
                </div>
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark line-clamp-3">
                  {analysis.usp}
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark">
                <div className="flex items-center gap-2 mb-4">
                  <span className={`material-symbols-outlined ${getSpeedColor(analysis.pageSpeed.score)}`}>
                    {getSpeedIcon(analysis.pageSpeed.score)}
                  </span>
                  <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">Page Speed</span>
                </div>
                <div className={`text-2xl font-bold ${getSpeedColor(analysis.pageSpeed.score)}`}>
                  {(analysis.pageSpeed.loadTime / 1000).toFixed(1)}s
                </div>
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark capitalize">
                  {analysis.pageSpeed.score}
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark">
                <div className="flex items-center gap-2 mb-4">
                  <span className={`material-symbols-outlined ${analysis.pixel?.detected ? 'text-green-500' : 'text-yellow-500'}`}>
                    {analysis.pixel?.detected ? 'check_circle' : 'warning'}
                  </span>
                  <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">Meta Pixel</span>
                </div>
                <div className={`text-lg font-semibold ${analysis.pixel?.detected ? 'text-green-500' : 'text-yellow-500'}`}>
                  {analysis.pixel?.detected ? 'Detected' : 'Not Found'}
                </div>
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  {analysis.pixel?.detected
                    ? (analysis.pixel.pixelId ? `ID: ${analysis.pixel.pixelId}` : 'Ready for tracking')
                    : 'Consider adding pixel'}
                </p>
                {analysis.pixel?.initEvents && analysis.pixel.initEvents.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {analysis.pixel.initEvents.slice(0, 3).map((event, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        {event}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {analysis.images.length > 0 && (
              <div className="p-6 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-primary">image</span>
                  <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">Images Found</span>
                </div>
                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                  {analysis.images.slice(0, 8).map((img, i) => (
                    <div key={i} className="aspect-square rounded-lg overflow-hidden bg-background-dark/10 relative group">
                      <img
                        src={img}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          console.warn('Failed to load image:', img);
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement?.classList.add('hidden');
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pixelAnalysis && (
              <div className={`p-6 rounded-2xl border ${pixelAnalysis.userLevel === 'pro' ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' :
                pixelAnalysis.userLevel === 'growing' ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' :
                  'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
                }`}>
                <div className="flex items-center gap-3 mb-4">
                  <span className={`material-symbols-outlined text-2xl ${pixelAnalysis.userLevel === 'pro' ? 'text-green-600' :
                    pixelAnalysis.userLevel === 'growing' ? 'text-blue-600' :
                      'text-yellow-600'
                    }`}>
                    {pixelAnalysis.userLevel === 'pro' ? 'rocket_launch' : pixelAnalysis.userLevel === 'growing' ? 'trending_up' : 'tips_and_updates'}
                  </span>
                  <div>
                    <h3 className="font-bold text-text-primary-light dark:text-text-primary-dark">
                      {pixelAnalysis.userLevel === 'pro' ? 'Pro Mode Unlocked' :
                        pixelAnalysis.userLevel === 'growing' ? 'Growing Nicely' :
                          'Getting Started'}
                    </h3>
                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                      Recommended: {pixelAnalysis.smartDefaults?.objective || 'Traffic'} Campaign
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {pixelAnalysis.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                      <span className="material-symbols-outlined text-base mt-0.5 text-primary">check</span>
                      {rec}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-center">
              <button
                onClick={() => setStep('creative')}
                className="px-8 py-3 rounded-xl bg-primary text-background-dark font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2 text-lg"
              >
                Continue to Ad Creative
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>
        )}

        {step === 'creative' && analysis && (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
                Pick Your Ad Creative
              </h2>
              <p className="text-text-secondary-light dark:text-text-secondary-dark">
                AI generated 3 variations - select or customize
              </p>
            </div>

            <div className="flex justify-center gap-4 mb-6">
              <button
                onClick={() => setAdFormat('image')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${adFormat === 'image'
                  ? 'bg-primary text-background-dark'
                  : 'bg-surface-light dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark hover:bg-primary/20'
                  }`}
              >
                <span className="material-symbols-outlined">image</span>
                Image Ad
              </button>
              <button
                onClick={() => setAdFormat('video')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${adFormat === 'video'
                  ? 'bg-primary text-background-dark'
                  : 'bg-surface-light dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark hover:bg-primary/20'
                  }`}
              >
                <span className="material-symbols-outlined">movie</span>
                Video Ad
                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">NEW</span>
              </button>
            </div>

            {adFormat === 'video' && (
              <div className="p-4 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark mb-6">
                <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-3">
                  Video Template Style
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setVideoTemplate('ProductShowcase')}
                    className={`p-4 rounded-lg text-center transition-all ${videoTemplate === 'ProductShowcase'
                      ? 'bg-primary/20 border-2 border-primary'
                      : 'bg-background-light dark:bg-background-dark border-2 border-transparent hover:border-primary/30'
                      }`}
                  >
                    <span className="material-symbols-outlined text-2xl mb-2 text-primary">zoom_in</span>
                    <div className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">Showcase</div>
                    <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark">Zoom & pan</div>
                  </button>
                  <button
                    onClick={() => setVideoTemplate('PriceDrop')}
                    className={`p-4 rounded-lg text-center transition-all ${videoTemplate === 'PriceDrop'
                      ? 'bg-primary/20 border-2 border-primary'
                      : 'bg-background-light dark:bg-background-dark border-2 border-transparent hover:border-primary/30'
                      }`}
                  >
                    <span className="material-symbols-outlined text-2xl mb-2 text-primary">sell</span>
                    <div className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">Price Drop</div>
                    <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark">Sale animation</div>
                  </button>
                  <button
                    onClick={() => setVideoTemplate('Testimonial')}
                    className={`p-4 rounded-lg text-center transition-all ${videoTemplate === 'Testimonial'
                      ? 'bg-primary/20 border-2 border-primary'
                      : 'bg-background-light dark:bg-background-dark border-2 border-transparent hover:border-primary/30'
                      }`}
                  >
                    <span className="material-symbols-outlined text-2xl mb-2 text-primary">format_quote</span>
                    <div className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">Testimonial</div>
                    <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark">Quote style</div>
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-3">
                    Headline
                  </label>
                  <div className="space-y-2">
                    {analysis.adCopy.map((ad, i) => (
                      <button
                        key={i}
                        onClick={() => { setSelectedHeadline(i); setCustomHeadline(''); }}
                        className={`w-full p-4 rounded-xl text-left transition-colors ${selectedHeadline === i && !customHeadline
                          ? 'bg-primary/20 border-2 border-primary'
                          : 'bg-surface-light dark:bg-surface-dark border-2 border-transparent hover:border-primary/30'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-text-primary-light dark:text-text-primary-dark font-medium">{ad.headline}</span>
                          <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary capitalize">{ad.angle.replace('_', ' ')}</span>
                        </div>
                      </button>
                    ))}
                    <input
                      type="text"
                      value={customHeadline}
                      onChange={(e) => setCustomHeadline(e.target.value)}
                      placeholder="Or write your own headline..."
                      className="w-full p-4 rounded-xl bg-surface-light dark:bg-surface-dark border-2 border-dashed border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark placeholder:text-text-secondary-light/50 focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-3">
                    Primary Text
                  </label>
                  <div className="space-y-2">
                    {analysis.adCopy.map((ad, i) => (
                      <button
                        key={i}
                        onClick={() => { setSelectedPrimaryText(i); setCustomPrimaryText(''); }}
                        className={`w-full p-4 rounded-xl text-left transition-colors ${selectedPrimaryText === i && !customPrimaryText
                          ? 'bg-primary/20 border-2 border-primary'
                          : 'bg-surface-light dark:bg-surface-dark border-2 border-transparent hover:border-primary/30'
                          }`}
                      >
                        <span className="text-text-primary-light dark:text-text-primary-dark">{ad.primaryText}</span>
                      </button>
                    ))}
                    <textarea
                      value={customPrimaryText}
                      onChange={(e) => setCustomPrimaryText(e.target.value)}
                      placeholder="Or write your own text..."
                      rows={2}
                      className="w-full p-4 rounded-xl bg-surface-light dark:bg-surface-dark border-2 border-dashed border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark placeholder:text-text-secondary-light/50 focus:border-primary focus:outline-none resize-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-3">
                    Call to Action
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {ctaOptions.map((cta) => (
                      <button
                        key={cta}
                        onClick={() => setSelectedCTA(cta)}
                        className={`px-4 py-2 rounded-lg transition-colors ${selectedCTA === cta
                          ? 'bg-primary text-background-dark'
                          : 'bg-surface-light dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark hover:bg-primary/20'
                          }`}
                      >
                        {cta}
                      </button>
                    ))}
                  </div>
                </div>

                {analysis.images.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-3">
                      Select Image
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {analysis.images.slice(0, 8).map((img, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setSelectedImage(i)
                            if (isCarouselMode) setCarouselIndex(i)
                          }}
                          className={`aspect-square rounded-lg overflow-hidden transition-all ${activeImageIndex === i ? 'ring-4 ring-primary scale-105' : 'hover:ring-2 ring-primary/30'
                            }`}
                        >
                          <img src={img} alt="" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:sticky lg:top-8">
                <div className="p-6 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">Live Preview</div>
                    {analysis.creativeIntent && (
                      <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                        <span className="material-symbols-outlined text-sm">auto_awesome</span>
                        {analysis.creativeIntent.suggestedFormat === 'interactive' && 'Interactive'}
                        {analysis.creativeIntent.suggestedFormat === 'zoom' && 'Zoom Effect'}
                        {analysis.creativeIntent.suggestedFormat === 'carousel' && 'Carousel'}
                        {analysis.creativeIntent.suggestedFormat === 'video' && 'Video'}
                        {analysis.creativeIntent.suggestedFormat === 'static' && 'Static'}
                      </div>
                    )}
                  </div>

                  <div className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-lg">
                    <div className="p-3 flex items-center gap-3 border-b border-gray-200 dark:border-gray-700">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/50" />
                      <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">{analysis.title || 'Your Business'}</div>
                        <div className="text-xs text-gray-500">Sponsored</div>
                      </div>
                    </div>

                    <div className="p-3">
                      <p className="text-sm text-gray-900 dark:text-white mb-3">
                        {customPrimaryText || analysis.adCopy[selectedPrimaryText]?.primaryText}
                      </p>
                    </div>

                    {adFormat === 'video' ? (
                      <div className="aspect-square bg-gray-900 relative overflow-hidden" style={{ minHeight: 300 }}>
                        {analysis.images.length === 0 ? (
                          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                            <div className="text-center">
                              <span className="material-symbols-outlined text-4xl mb-2">image_not_supported</span>
                              <p className="text-sm">No images found for video preview</p>
                            </div>
                          </div>
                        ) : (
                          <>
                            {videoTemplate === 'ProductShowcase' && (
                              <Player
                                component={ProductShowcase}
                                inputProps={{
                                  productImage: analysis.images[selectedImage] || analysis.images[0] || '',
                                  headline: customHeadline || analysis.adCopy[selectedHeadline]?.headline || 'Your Headline',
                                  primaryText: customPrimaryText || analysis.adCopy[selectedPrimaryText]?.primaryText || '',
                                  brandColor: analysis.brandColors?.[0] || '#13ec80',
                                  ctaText: selectedCTA || 'Shop Now',
                                }}
                                durationInFrames={150}
                                compositionWidth={1080}
                                compositionHeight={1080}
                                fps={30}
                                style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
                                controls
                                loop
                                autoPlay
                              />
                            )}
                            {videoTemplate === 'PriceDrop' && (
                              <Player
                                component={PriceDrop}
                                inputProps={{
                                  productImage: analysis.images[selectedImage] || analysis.images[0] || '',
                                  productName: analysis.title || 'Product',
                                  originalPrice: '$99',
                                  salePrice: '$49',
                                  brandColor: analysis.brandColors?.[0] || '#13ec80',
                                  ctaText: selectedCTA || 'Shop Now',
                                }}
                                durationInFrames={120}
                                compositionWidth={1080}
                                compositionHeight={1080}
                                fps={30}
                                style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
                                controls
                                loop
                                autoPlay
                              />
                            )}
                            {videoTemplate === 'Testimonial' && (
                              <Player
                                component={Testimonial}
                                inputProps={{
                                  productImage: analysis.images[selectedImage] || analysis.images[0] || '',
                                  quote: `"${analysis.usp || 'This product is amazing!'}"`,
                                  author: 'Happy Customer',
                                  brandColor: analysis.brandColors?.[0] || '#13ec80',
                                  ctaText: selectedCTA || 'Shop Now',
                                }}
                                durationInFrames={180}
                                compositionWidth={1080}
                                compositionHeight={1080}
                                fps={30}
                                style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
                                controls
                                loop
                                autoPlay
                              />
                            )}
                          </>
                        )}
                      </div>
                    ) : analysis.images.length > 0 && (
                      <div className={`aspect-square bg-gray-100 dark:bg-gray-800 relative overflow-hidden group ${analysis.creativeIntent?.previewEffect === 'hover_glow' ? 'cursor-pointer' : ''
                        }`}>
                        {analysis.creativeIntent?.previewEffect === 'carousel_slide' ? (
                          <>
                            <div className="w-full h-full relative">
                              {analysis.images.slice(0, 4).map((img, idx) => (
                                <img
                                  key={idx}
                                  src={img}
                                  alt=""
                                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${idx === carouselIndex ? 'opacity-100' : 'opacity-0'
                                    }`}
                                />
                              ))}
                            </div>
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                              {analysis.images.slice(0, 4).map((_, idx) => (
                                <div
                                  key={idx}
                                  className={`w-2 h-2 rounded-full transition-colors ${idx === carouselIndex ? 'bg-white' : 'bg-white/40'
                                    }`}
                                />
                              ))}
                            </div>
                          </>
                        ) : (
                          <>
                            <img
                              src={analysis.images[selectedImage]}
                              alt=""
                              className={`w-full h-full object-cover transition-all duration-500 ${analysis.creativeIntent?.previewEffect === 'zoom_pulse'
                                ? 'animate-pulse-zoom'
                                : analysis.creativeIntent?.previewEffect === 'hover_glow'
                                  ? 'group-hover:scale-105 group-hover:brightness-110'
                                  : ''
                                }`}
                            />
                            {analysis.creativeIntent?.previewEffect === 'hover_glow' && (
                              <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                            )}
                            {analysis.creativeIntent?.previewEffect === 'video_play' && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                                  <span className="material-symbols-outlined text-3xl text-gray-900 ml-1">play_arrow</span>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    <div className="p-3 bg-gray-50 dark:bg-gray-800">
                      <div className="text-xs text-gray-500 uppercase mb-1">{new URL(analysis.url).hostname}</div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {customHeadline || analysis.adCopy[selectedHeadline]?.headline}
                      </div>
                      <button className="mt-2 px-4 py-1.5 bg-gray-200 dark:bg-gray-700 text-sm font-medium text-gray-900 dark:text-white rounded">
                        {selectedCTA}
                      </button>
                    </div>
                  </div>

                  {analysis.creativeIntent && (
                    <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                        <span className="material-symbols-outlined text-sm text-primary align-middle mr-1">tips_and_updates</span>
                        {analysis.creativeIntent.formatReason}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep('results')}
                className="px-6 py-3 rounded-xl border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined">arrow_back</span>
                Back
              </button>
              <button
                onClick={() => setStep('targeting')}
                className="px-8 py-3 rounded-xl bg-primary text-background-dark font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                Continue to Targeting
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>
        )}

        {step === 'targeting' && analysis && (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
                Target Your Audience
              </h2>
              <p className="text-text-secondary-light dark:text-text-secondary-dark">
                AI-suggested targeting based on your product
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="p-6 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-primary">interests</span>
                    <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">Interests</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">AI Suggested</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {analysis.targetAudience.interests.map((interest) => (
                      <button
                        key={interest}
                        onClick={() => {
                          if (selectedInterests.includes(interest)) {
                            setSelectedInterests(selectedInterests.filter(i => i !== interest))
                          } else {
                            setSelectedInterests([...selectedInterests, interest])
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm transition-colors ${selectedInterests.includes(interest)
                          ? 'bg-primary text-background-dark'
                          : 'bg-primary/10 text-primary hover:bg-primary/20'
                          }`}
                      >
                        {interest}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-primary">calendar_month</span>
                    <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">Age Range</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <label className="text-xs text-text-secondary-light dark:text-text-secondary-dark">Min</label>
                      <input
                        type="number"
                        value={ageRange.min}
                        onChange={(e) => setAgeRange({ ...ageRange, min: parseInt(e.target.value) || 18 })}
                        min={18}
                        max={65}
                        className="w-20 p-2 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark text-center"
                      />
                    </div>
                    <span className="text-text-secondary-light dark:text-text-secondary-dark">to</span>
                    <div>
                      <label className="text-xs text-text-secondary-light dark:text-text-secondary-dark">Max</label>
                      <input
                        type="number"
                        value={ageRange.max}
                        onChange={(e) => setAgeRange({ ...ageRange, max: parseInt(e.target.value) || 65 })}
                        min={18}
                        max={65}
                        className="w-20 p-2 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark text-center"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-primary">wc</span>
                    <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">Gender</span>
                  </div>
                  <div className="flex gap-2">
                    {['all', 'male', 'female'].map((g) => (
                      <button
                        key={g}
                        onClick={() => setSelectedGender(g)}
                        className={`flex-1 py-2 rounded-lg capitalize transition-colors ${selectedGender === g
                          ? 'bg-primary text-background-dark'
                          : 'bg-primary/10 text-primary hover:bg-primary/20'
                          }`}
                      >
                        {g === 'all' ? 'All' : g}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark opacity-60">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-yellow-500">lock</span>
                    <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">Lookalike Audiences</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500">Connect Facebook to unlock</span>
                  </div>
                  <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    Target people similar to your best customers
                  </p>
                </div>

                <div className="p-6 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark opacity-60">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-yellow-500">lock</span>
                    <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">Retargeting</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500">Connect Facebook to unlock</span>
                  </div>
                  <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    Re-engage people who visited your website
                  </p>
                </div>
              </div>

              <div className="lg:sticky lg:top-8">
                <div className="p-6 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark">
                  <div className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mb-4">Audience Summary</div>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-text-secondary-light dark:text-text-secondary-dark">Interests</span>
                      <span className="text-text-primary-light dark:text-text-primary-dark font-medium">{selectedInterests.length} selected</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary-light dark:text-text-secondary-dark">Age</span>
                      <span className="text-text-primary-light dark:text-text-primary-dark font-medium">{ageRange.min} - {ageRange.max}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary-light dark:text-text-secondary-dark">Gender</span>
                      <span className="text-text-primary-light dark:text-text-primary-dark font-medium capitalize">{selectedGender}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary-light dark:text-text-secondary-dark">Locations</span>
                      <span className="text-text-primary-light dark:text-text-primary-dark font-medium">{locations.join(', ')}</span>
                    </div>
                    <hr className="border-border-light dark:border-border-dark" />
                    <div className="flex justify-between items-center">
                      <span className="text-text-primary-light dark:text-text-primary-dark font-semibold">Est. Audience Size</span>
                      <span className="text-2xl font-bold text-primary">2.5M - 5M</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep('creative')}
                className="px-6 py-3 rounded-xl border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined">arrow_back</span>
                Back
              </button>
              <button
                onClick={() => setStep('budget')}
                className="px-8 py-3 rounded-xl bg-primary text-background-dark font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                Continue to Budget
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>
        )}

        {step === 'budget' && analysis && (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
                Set Your Budget
              </h2>
              <p className="text-text-secondary-light dark:text-text-secondary-dark">
                How much do you want to spend?
              </p>
            </div>

            <div className="max-w-2xl mx-auto space-y-8">
              <div className="p-6 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark">
                <div className="flex items-center justify-between mb-6">
                  <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">Daily Budget</span>
                  <span className="text-3xl font-bold text-primary">${dailyBudget}</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={500}
                  step={5}
                  value={dailyBudget}
                  onChange={(e) => setDailyBudget(parseInt(e.target.value))}
                  className="w-full h-2 bg-primary/20 rounded-full appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-sm text-text-secondary-light dark:text-text-secondary-dark mt-2">
                  <span>$5</span>
                  <span>$500</span>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">Duration</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[3, 7, 14, 30].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={`py-3 rounded-xl font-medium transition-colors ${duration === d
                        ? 'bg-primary text-background-dark'
                        : 'bg-primary/10 text-primary hover:bg-primary/20'
                        }`}
                    >
                      {d} days
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-3xl font-bold text-primary">${dailyBudget * duration}</div>
                    <div className="text-sm text-text-secondary-light dark:text-text-secondary-dark">Total Spend</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark">{(estimatedReach / 1000).toFixed(0)}K</div>
                    <div className="text-sm text-text-secondary-light dark:text-text-secondary-dark">Est. Reach</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark">{estimatedClicks}</div>
                    <div className="text-sm text-text-secondary-light dark:text-text-secondary-dark">Est. Clicks</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between max-w-2xl mx-auto">
              <button
                onClick={() => setStep('targeting')}
                className="px-6 py-3 rounded-xl border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined">arrow_back</span>
                Back
              </button>
              <button
                onClick={() => setStep('preview')}
                className="px-8 py-3 rounded-xl bg-primary text-background-dark font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                Preview Ad
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>
        )}

        {step === 'preview' && analysis && (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
                Preview Your Ad
              </h2>
              <p className="text-text-secondary-light dark:text-text-secondary-dark">
                This is how your ad will look
              </p>
            </div>

            <div className="flex justify-center gap-4 mb-8">
              <button
                onClick={() => setPreviewPlatform('facebook')}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${previewPlatform === 'facebook'
                  ? 'bg-blue-600 text-white'
                  : 'bg-surface-light dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark'
                  }`}
              >
                Facebook
              </button>
              <button
                onClick={() => setPreviewPlatform('instagram')}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${previewPlatform === 'instagram'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white'
                  : 'bg-surface-light dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark'
                  }`}
              >
                Instagram
              </button>
            </div>

            <div className="flex justify-center">
              <div className="w-full max-w-md">
                {previewPlatform === 'facebook' ? (
                  <div className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-2xl">
                    <div className="p-4 flex items-center gap-3 border-b border-gray-200 dark:border-gray-700">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/50" />
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 dark:text-white">{analysis.title || 'Your Business'}</div>
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                          <span>Sponsored</span>
                          <span>·</span>
                          <span className="material-symbols-outlined text-xs">public</span>
                        </div>
                      </div>
                      <button className="text-gray-500">
                        <span className="material-symbols-outlined">more_horiz</span>
                      </button>
                    </div>

                    <div className="p-4">
                      <p className="text-gray-900 dark:text-white">
                        {customPrimaryText || analysis.adCopy[selectedPrimaryText]?.primaryText}
                      </p>
                    </div>

                    {analysis.images[activeImageIndex] && (
                      <div className="aspect-square bg-gray-100 dark:bg-gray-800">
                        <img src={analysis.images[activeImageIndex]} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}

                    <div className="p-4 bg-gray-50 dark:bg-gray-800">
                      <div className="text-xs text-gray-500 uppercase mb-1">{new URL(analysis.url).hostname}</div>
                      <div className="font-semibold text-gray-900 dark:text-white mb-2">
                        {customHeadline || analysis.adCopy[selectedHeadline]?.headline}
                      </div>
                      <button className="w-full py-2 bg-blue-600 text-white font-medium rounded-md">
                        {selectedCTA}
                      </button>
                    </div>

                    <div className="p-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
                      <button className="flex items-center gap-2 text-gray-500">
                        <span className="material-symbols-outlined">thumb_up</span>
                        <span>Like</span>
                      </button>
                      <button className="flex items-center gap-2 text-gray-500">
                        <span className="material-symbols-outlined">chat_bubble</span>
                        <span>Comment</span>
                      </button>
                      <button className="flex items-center gap-2 text-gray-500">
                        <span className="material-symbols-outlined">share</span>
                        <span>Share</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-black rounded-xl overflow-hidden shadow-2xl">
                    <div className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/50 ring-2 ring-pink-500" />
                      <div className="flex-1">
                        <div className="font-semibold text-white text-sm">{analysis.title?.toLowerCase().replace(/\s+/g, '_') || 'your_business'}</div>
                        <div className="text-xs text-gray-400">Sponsored</div>
                      </div>
                      <button className="text-white">
                        <span className="material-symbols-outlined">more_horiz</span>
                      </button>
                    </div>

                    {analysis.images[activeImageIndex] && (
                      <div className="aspect-square bg-gray-900">
                        <img src={analysis.images[activeImageIndex]} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}

                    <div className="p-4">
                      <div className="flex gap-4 mb-3">
                        <span className="material-symbols-outlined text-white">favorite_border</span>
                        <span className="material-symbols-outlined text-white">chat_bubble_outline</span>
                        <span className="material-symbols-outlined text-white">send</span>
                        <span className="material-symbols-outlined text-white ml-auto">bookmark_border</span>
                      </div>
                      <p className="text-white text-sm">
                        <span className="font-semibold">{analysis.title?.toLowerCase().replace(/\s+/g, '_') || 'your_business'}</span>{' '}
                        {customPrimaryText || analysis.adCopy[selectedPrimaryText]?.primaryText}
                      </p>
                      <button className="mt-3 w-full py-2 bg-white text-black font-medium rounded-md text-sm">
                        {selectedCTA}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="max-w-md mx-auto p-4 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark">
              <div className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mb-3">Campaign Summary</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary-light dark:text-text-secondary-dark">Budget</span>
                  <span className="text-text-primary-light dark:text-text-primary-dark font-medium">${dailyBudget}/day for {duration} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary-light dark:text-text-secondary-dark">Total</span>
                  <span className="text-text-primary-light dark:text-text-primary-dark font-medium">${dailyBudget * duration}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary-light dark:text-text-secondary-dark">Targeting</span>
                  <span className="text-text-primary-light dark:text-text-primary-dark font-medium">{selectedInterests.length} interests, {ageRange.min}-{ageRange.max}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between max-w-2xl mx-auto">
              <button
                onClick={() => setStep('budget')}
                className="px-6 py-3 rounded-xl border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined">arrow_back</span>
                Back
              </button>
              <button
                onClick={() => setStep('launch')}
                className="px-8 py-3 rounded-xl bg-primary text-background-dark font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2 text-lg"
              >
                Ready to Launch
                <span className="material-symbols-outlined">rocket_launch</span>
              </button>
            </div>
          </div>
        )}

        {step === 'launch' && analysis && (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-primary">rocket_launch</span>
              </div>
              <h2 className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
                {connectedAccount ? 'Ready for Liftoff 🚀' : 'Connect Facebook to Launch'}
              </h2>
              <p className="text-text-secondary-light dark:text-text-secondary-dark">
                {connectedAccount
                  ? `Launch this campaign to ${connectedAccount.name} (${connectedAccount.id})`
                  : 'One last step to publish your ad'
                }
              </p>
            </div>

            <div className="max-w-md mx-auto space-y-6">

              {!connectedAccount ? (
                // NOT CONNECTED STATE
                <>
                  <div className="p-6 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark">
                    <div className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mb-4">
                      Connecting Facebook unlocks:
                    </div>
                    <ul className="space-y-3">
                      <li className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary">check_circle</span>
                        <span className="text-text-primary-light dark:text-text-primary-dark">Publish your ad to Facebook & Instagram</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary">check_circle</span>
                        <span className="text-text-primary-light dark:text-text-primary-dark">Lookalike audience targeting</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary">check_circle</span>
                        <span className="text-text-primary-light dark:text-text-primary-dark">Auto-optimization of ads</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    onClick={() => {
                      const width = 600
                      const height = 700
                      const left = window.screenX + (window.outerWidth - width) / 2
                      const top = window.screenY + (window.outerHeight - height) / 2
                      window.open(
                        '/api/auth/meta/connect?tenantId=1',
                        'facebook-auth',
                        `width=${width},height=${height},left=${left},top=${top}`
                      )
                    }}
                    className="w-full py-4 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-3 text-lg"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    Connect with Facebook
                  </button>
                </>
              ) : (
                // CONNECTED STATE
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-3 text-green-600 dark:text-green-400">
                    <span className="material-symbols-outlined">link</span>
                    <span className="font-medium">Connected to {connectedAccount.name}</span>
                  </div>

                  <button
                    onClick={async () => {
                      if (!connectedAccount) return;
                      setIsLaunching(true);
                      setError(null);

                      try {
                        const response = await fetch('/api/launch', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            accountId: connectedAccount.id,
                            campaignName: `Boost: ${analysis.title || 'New Campaign'}`,
                            objective: pixelAnalysis?.recommendedObjective || 'OUTCOME_TRAFFIC',
                            budget: dailyBudget,
                            duration: duration,
                            targeting: {
                              interests: selectedInterests,
                              ageMin: ageRange.min,
                              ageMax: ageRange.max,
                              // TODO: pass genders and locations if we added selector support
                            },
                            creative: {
                              headline: customHeadline || analysis.adCopy[selectedHeadline].headline,
                              primaryText: customPrimaryText || analysis.adCopy[selectedPrimaryText].primaryText,
                              // In a real app we would pass image URL or ID. Sync service handles limited logic for now.
                              image: analysis.images[selectedImage],
                              // Pass a dummy creativeId if we don't have one (simulation/monitor mode handles it?)
                              // The backend will warn if missing. For MVP we proceed to success for the UI flow.
                            },
                            status: 'ACTIVE'
                          })
                        });

                        const data = await response.json();
                        if (data.error) throw new Error(data.error);

                        setStep('success');

                      } catch (e: any) {
                        setError(e.message || 'Launch failed');
                      } finally {
                        setIsLaunching(false);
                      }
                    }}
                    disabled={isLaunching}
                    className="w-full py-4 rounded-xl bg-primary text-background-dark font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-3 text-xl shadow-lg shadow-primary/20 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isLaunching ? (
                      <>
                        <span className="material-symbols-outlined animate-spin">refresh</span>
                        Launching...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-2xl">rocket_launch</span>
                        Launch Campaign Now
                      </>
                    )}
                  </button>
                  {error && (
                    <div className="text-red-500 text-center text-sm">{error}</div>
                  )}
                </div>
              )}

              <p className="text-center text-sm text-text-secondary-light dark:text-text-secondary-dark">
                {connectedAccount
                  ? `Total budget: $${dailyBudget * duration} over ${duration} days`
                  : "We'll never post without your permission"
                }
              </p>
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => setStep('preview')}
                disabled={isLaunching}
                className="px-6 py-3 rounded-xl border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined">arrow_back</span>
                Back to Preview
              </button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
            <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30 animate-bounce">
              <span className="material-symbols-outlined text-5xl text-white">check</span>
            </div>
            <div>
              <h2 className="text-4xl font-bold text-text-primary-light dark:text-text-primary-dark mb-4">
                Campaign Launched! 🚀
              </h2>
              <p className="text-xl text-text-secondary-light dark:text-text-secondary-dark max-w-lg mx-auto">
                Your ad is now active. You can monitor its performance in the dashboard.
              </p>
            </div>
            <div className="pt-8">
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="px-8 py-4 rounded-xl bg-surface-light dark:bg-surface-dark border-2 border-primary text-primary font-bold hover:bg-primary hover:text-background-dark transition-all flex items-center gap-3 text-lg"
              >
                <span className="material-symbols-outlined">analytics</span>
                Go to Dashboard
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
