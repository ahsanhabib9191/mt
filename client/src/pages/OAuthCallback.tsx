import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

export default function OAuthCallback() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [message, setMessage] = useState('Connecting your Facebook account...')
  const [accounts, setAccounts] = useState<any[]>([])
  const isPopup = window.opener !== null

  const notifyOpener = (success: boolean, error?: string) => {
    if (window.opener) {
      window.opener.postMessage({ type: 'oauth_complete', success, error }, '*')
    }
  }

  const closeOrRedirect = () => {
    if (isPopup) {
      window.close()
    } else {
      window.location.href = '/'
    }
  }

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code')
      const state = searchParams.get('state')
      const error = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')

      if (error) {
        setStatus('error')
        setMessage(errorDescription || 'Authorization was denied')
        notifyOpener(false, errorDescription || 'Authorization was denied')
        return
      }

      if (!code) {
        setStatus('error')
        setMessage('No authorization code received')
        notifyOpener(false, 'No authorization code received')
        return
      }

      const savedState = localStorage.getItem('oauth_state')
      if (state !== savedState) {
        console.warn('State mismatch, but continuing...', { received: state, saved: savedState })
      }

      try {
        const response = await fetch('/api/auth/meta/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            tenantId: 1,
          }),
        })

        const data = await response.json()

        if (data.error) {
          setStatus('error')
          setMessage(data.error)
          notifyOpener(false, data.error)
          return
        }

        setStatus('success')
        setMessage('Facebook account connected successfully!')
        setAccounts(data.data?.availableAccounts || [])
        
        localStorage.removeItem('oauth_state')
        localStorage.setItem('connected_account', JSON.stringify(data.data))
        
        notifyOpener(true)

        setTimeout(() => {
          closeOrRedirect()
        }, 3000)
      } catch (err) {
        setStatus('error')
        setMessage('Failed to complete connection. Please try again.')
        console.error('Callback error:', err)
        notifyOpener(false, 'Failed to complete connection')
      }
    }

    handleCallback()
  }, [searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-4">
      <div className="max-w-md w-full bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-8 text-center">
        {status === 'processing' && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-primary animate-spin">progress_activity</span>
            </div>
            <h1 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
              Connecting...
            </h1>
            <p className="text-text-secondary-light dark:text-text-secondary-dark">
              {message}
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-green-500">check_circle</span>
            </div>
            <h1 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
              Connected!
            </h1>
            <p className="text-text-secondary-light dark:text-text-secondary-dark mb-4">
              {message}
            </p>
            
            {accounts.length > 0 && (
              <div className="mt-4 text-left">
                <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
                  Available Ad Accounts:
                </p>
                <div className="space-y-2">
                  {accounts.map((account: any) => (
                    <div key={account.id} className="p-3 bg-background-light dark:bg-background-dark rounded-lg text-sm">
                      <div className="font-medium text-text-primary-light dark:text-text-primary-dark">
                        {account.name}
                      </div>
                      <div className="text-text-secondary-light dark:text-text-secondary-dark text-xs">
                        {account.currency} | {account.timezone_name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-4">
              Redirecting to dashboard...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-red-500">error</span>
            </div>
            <h1 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
              Connection Failed
            </h1>
            <p className="text-text-secondary-light dark:text-text-secondary-dark mb-6">
              {message}
            </p>
            <button
              onClick={() => {
                if (isPopup) {
                  window.close()
                } else {
                  window.location.href = '/welcome'
                }
              }}
              className="px-6 py-2 bg-primary text-background-dark rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              {isPopup ? 'Close' : 'Try Again'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
