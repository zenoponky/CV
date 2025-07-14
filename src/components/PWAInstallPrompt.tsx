import React, { useState, useEffect, useCallback } from 'react';
import { X, Download, Info, Smartphone, Monitor } from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed', platform: string }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showDesktopNotification, setShowDesktopNotification] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const location = useLocation();

  const PROMPT_DISMISSED_KEY = 'pwa_install_prompt_dismissed_at';
  const PROMPT_COUNT_KEY = 'pwa_install_prompt_session_count';
  const MAX_PROMPTS_PER_SESSION = 2;
  const DISMISS_FOR_DAYS = 30;

  const checkIsMobile = useCallback(() => {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    return /android|ipad|iphone|ipod/i.test(userAgent);
  }, []);

  const checkIfDismissed = useCallback(() => {
    const dismissedAt = localStorage.getItem(PROMPT_DISMISSED_KEY);
    if (dismissedAt) {
      const dismissedDate = new Date(parseInt(dismissedAt, 10));
      const dismissForDays = new Date();
      dismissForDays.setDate(dismissForDays.getDate() - DISMISS_FOR_DAYS);
      return dismissedDate > dismissForDays;
    }
    return false;
  }, []);

  const checkSessionCount = useCallback(() => {
    const sessionCount = parseInt(sessionStorage.getItem(PROMPT_COUNT_KEY) || '0', 10);
    return sessionCount >= MAX_PROMPTS_PER_SESSION;
  }, []);

  const shouldShowPrompt = useCallback(() => {
    return (
      deferredPrompt &&
      hasInteracted &&
      !checkIfDismissed() &&
      !checkSessionCount() &&
      (location.pathname === '/dashboard' || 
       location.pathname === '/premium' || 
       location.pathname === '/success' ||
       location.pathname === '/account')
    );
  }, [deferredPrompt, hasInteracted, location.pathname, checkIfDismissed, checkSessionCount]);

  useEffect(() => {
    setIsMobile(checkIsMobile());

    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleUserInteraction = () => {
      setHasInteracted(true);
    };

    // Listen for meaningful interactions
    const interactionEvents = ['click', 'scroll', 'keydown', 'touchstart'];
    interactionEvents.forEach(event => {
      document.addEventListener(event, handleUserInteraction, { once: true });
    });

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      interactionEvents.forEach(event => {
        document.removeEventListener(event, handleUserInteraction);
      });
    };
  }, [checkIsMobile]);

  useEffect(() => {
    if (shouldShowPrompt()) {
      const timer = setTimeout(() => {
        if (isMobile) {
          setShowInstallBanner(true);
        } else {
          setShowDesktopNotification(true);
          // Auto-dismiss desktop notification after 10 seconds
          const dismissTimer = setTimeout(() => setShowDesktopNotification(false), 10000);
          return () => clearTimeout(dismissTimer);
        }
      }, 2000); // Show after 2 seconds of interaction

      return () => clearTimeout(timer);
    }
  }, [shouldShowPrompt, isMobile]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Increment session prompt count
    const sessionCount = parseInt(sessionStorage.getItem(PROMPT_COUNT_KEY) || '0', 10);
    sessionStorage.setItem(PROMPT_COUNT_KEY, (sessionCount + 1).toString());

    setShowInstallBanner(false);
    setShowDesktopNotification(false);

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        console.log('User accepted the PWA install prompt');
        // Track successful installation
        if (window.gtag) {
          window.gtag('event', 'pwa_install', {
            event_category: 'PWA',
            event_label: isMobile ? 'mobile' : 'desktop',
          });
        }
      } else {
        console.log('User dismissed the PWA install prompt');
        localStorage.setItem(PROMPT_DISMISSED_KEY, Date.now().toString());
      }
      
      setDeferredPrompt(null);
    } catch (error) {
      console.error('Error during PWA installation:', error);
    }
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    setShowDesktopNotification(false);
    localStorage.setItem(PROMPT_DISMISSED_KEY, Date.now().toString());
    
    // Increment session prompt count even on dismissal
    const sessionCount = parseInt(sessionStorage.getItem(PROMPT_COUNT_KEY) || '0', 10);
    sessionStorage.setItem(PROMPT_COUNT_KEY, (sessionCount + 1).toString());

    // Track dismissal
    if (window.gtag) {
      window.gtag('event', 'pwa_install_dismissed', {
        event_category: 'PWA',
        event_label: isMobile ? 'mobile' : 'desktop',
      });
    }
  };

  if (!deferredPrompt) return null;

  return (
    <>
      {/* Mobile Install Banner */}
      {showInstallBanner && isMobile && (
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 shadow-xl z-50 animate-slide-up">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <div className="flex items-center space-x-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">Install Zolla App</p>
                <p className="text-xs opacity-90">Get faster access & offline features!</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleInstallClick}
                className="bg-white text-blue-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors shadow-sm"
              >
                Install
              </button>
              <button 
                onClick={handleDismiss} 
                className="text-white/80 hover:text-white transition-colors p-1"
                aria-label="Dismiss install prompt"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Notification */}
      {showDesktopNotification && !isMobile && (
        <div className="fixed top-4 right-4 bg-white text-gray-800 p-4 rounded-xl shadow-2xl z-50 max-w-sm animate-slide-in-right border border-gray-200">
          <div className="flex items-start space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Monitor className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-semibold text-sm text-gray-900">Install Zolla</h4>
                <button 
                  onClick={handleDismiss} 
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Dismiss install prompt"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-gray-600 mb-3">
                Add to your desktop for quick access and better performance.
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={handleInstallClick}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors flex items-center space-x-1"
                >
                  <Download className="h-3 w-3" />
                  <span>Install</span>
                </button>
                <button
                  onClick={handleDismiss}
                  className="text-gray-500 hover:text-gray-700 transition-colors text-xs font-medium px-2"
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

export default PWAInstallPrompt;