// Parent information
export interface ParentContext {
  first_name?: string
  email?: string
  phone?: string
  marketing_consent?: boolean
}

// Student information
export interface StudentContext {
  grade_entering?: number
  recent_math_range?: string
  concerns?: string[]
  learning_profile?: string
  primary_goal?: string
}

// Support intent and classification
export interface IntentData {
  support_intent?: string
  purchase_intent_score?: number
  classification?: 'RESOURCE' | 'WARM' | 'HIGH_INTENT' | 'BOOKED' | 'CLIENT'
  marketing_consent?: boolean
}

// Diagnostic answer
export interface DiagnosticAnswer {
  question_id: string
  answer: string
}

// Diagnostic results
export interface DiagnosticData {
  answers: DiagnosticAnswer[]
  questions_presented?: number
  skills: Record<string, any>
  overall_result?: {
    percentage: number
    classification: string
  }
  priority_skills?: string[]
}

// Attribution tracking
export interface AttributionData {
  source?: string
  content?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
}

// Complete readiness assessment state
export interface ReadinessState {
  id?: string
  created_at?: string
  parent: ParentContext
  student: StudentContext
  intent: IntentData
  diagnostic: DiagnosticData
  attribution: AttributionData
}

// For database/admin view
export interface ReadinessLead {
  id: string
  created_at: string
  parent_name?: string
  parent_email?: string
  parent_phone?: string
  student_grade?: number
  recent_math_range?: string
  concerns?: string[]
  learning_profile?: string
  primary_goal?: string
  support_intent?: string
  purchase_intent_score?: number
  classification?: string
  overall_readiness?: number
  priority_skills?: string[]
  source?: string
  utm_source?: string
  utm_medium?: string
  booking_completed?: boolean
  booking_date?: string
}
