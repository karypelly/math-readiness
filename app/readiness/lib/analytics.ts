// Analytics event tracking for readiness assessment
// Tracks user flow and engagement without sending sensitive student data

export type AnalyticsEventName =
  | 'readiness_started'
  | 'parent_context_completed'
  | 'diagnostic_started'
  | 'diagnostic_completed'
  | 'lead_captured'
  | 'results_viewed'
  | 'resource_clicked'
  | 'offer_clicked'
  | 'booking_clicked'

export interface AnalyticsEventData {
  [key: string]: any
}

/**
 * Track an analytics event
 * Sends to your analytics platform (Google Analytics, Segment, etc.)
 * Do not send sensitive student answer data
 */
export function trackAnalytics(
  eventName: AnalyticsEventName,
  data?: AnalyticsEventData
): void {
  try {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`Analytics: ${eventName}`, data)
    }

    // Send to Google Analytics if available
    if (typeof window !== 'undefined' && (window as any).gtag) {
      ;(window as any).gtag('event', eventName, {
        event_category: 'readiness_assessment',
        ...data,
      })
    }

    // Send to custom backend if configured
    if (process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT) {
      sendToBackend(eventName, data)
    }
  } catch (error) {
    console.error('Analytics tracking error:', error)
  }
}

async function sendToBackend(
  eventName: AnalyticsEventName,
  data?: AnalyticsEventData
): Promise<void> {
  try {
    const response = await fetch(process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: eventName,
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : null,
        ...data,
      }),
    })

    if (!response.ok) {
      console.error('Analytics backend error:', response.statusText)
    }
  } catch (error) {
    console.error('Failed to send analytics:', error)
  }
}

/**
 * Calculate purchase intent score based on stated intent
 * 0 = low intent, higher = more likely to purchase
 */
export function calculatePurchaseIntentScore(supportIntent?: string): number {
  const scores: Record<string, number> = {
    'free-resources': 0,
    'understand-gaps-first': 3,
    'occasional': 5,
    'weekly': 10,
    'ongoing': 12,
  }

  return scores[supportIntent || 'free-resources'] || 0
}

/**
 * Classify a lead based on academic need and purchase intent
 * Separate these concepts—academic need and buying intent are independent
 */
export function classifyLead(
  academicNeedScore: number,
  purchaseIntentScore: number
): 'RESOURCE' | 'WARM' | 'HIGH_INTENT' | 'CLIENT' {
  // High intent to purchase
  if (purchaseIntentScore >= 10) {
    return 'HIGH_INTENT'
  }

  // Moderate intent
  if (purchaseIntentScore >= 3) {
    return 'WARM'
  }

  // Low intent (mainly resources)
  return 'RESOURCE'
}

/**
 * Generate lead score summary for internal use
 * Safe to log to backend—doesn't contain sensitive answer data
 */
export function generateLeadSummary(
  academicNeedScore: number,
  purchaseIntentScore: number,
  classification: string
): string {
  const descriptions: Record<string, string> = {
    RESOURCE: 'Parent seeking free resources and information',
    WARM: 'Parent considering tutoring, wants to understand gaps first',
    HIGH_INTENT: 'Parent actively looking for tutoring/support',
  }

  return descriptions[classification] || 'Readiness assessment lead'
}
