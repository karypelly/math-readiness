'use client'

import React, { useState, useEffect } from 'react'
import { diagnosticQuestions } from './data/diagnostic-questions'
import { analyzeReadiness } from './lib/analysis-engine'
import { trackAnalytics } from './lib/analytics'
import type { ReadinessState, ParentContext, DiagnosticAnswer } from './types/readiness'

function ChevronRight({ size = 20 }: { size?: number }) {
  return <span style={{ fontSize: size, lineHeight: 1 }} aria-hidden="true">›</span>
}

function ChevronLeft({ size = 20 }: { size?: number }) {
  return <span style={{ fontSize: size, lineHeight: 1 }} aria-hidden="true">‹</span>
}

const STORAGE_KEY = 'readiness_assessment_draft'
const READINESS_STEPS = [
  'intro',
  'parent-grade',
  'parent-performance',
  'parent-concerns',
  'parent-profile',
  'parent-goals',
  'parent-intent',
  'diagnostic-intro',
  'diagnostic-questions',
  'email-capture',
  'results',
  'next-step',
]

export default function ReadinessAssessment() {
  const [currentStep, setCurrentStep] = useState(0)
  const [state, setState] = useState<ReadinessState>({
    parent: {},
    student: {},
    intent: {},
    diagnostic: { answers: [], skills: {} },
    attribution: {},
  })
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  // Restore draft from localStorage on mount
  useEffect(() => {
    const draft = localStorage.getItem(STORAGE_KEY)
    if (draft) {
      try {
        const parsed = JSON.parse(draft)
        setState(parsed.state)
        setCurrentStep(parsed.currentStep)
        setCurrentQuestionIndex(parsed.currentQuestionIndex)
      } catch (e) {
        console.error('Failed to restore draft', e)
      }
    }
    // Get URL attribution
    const params = new URLSearchParams(window.location.search)
    setState(prev => ({
      ...prev,
      attribution: {
        source: params.get('source') || undefined,
        content: params.get('content') || undefined,
        utm_source: params.get('utm_source') || undefined,
        utm_medium: params.get('utm_medium') || undefined,
        utm_campaign: params.get('utm_campaign') || undefined,
        utm_content: params.get('utm_content') || undefined,
      },
    }))
  }, [])

  // Persist draft to localStorage on state change
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state, currentStep, currentQuestionIndex })
    )
  }, [state, currentStep, currentQuestionIndex])

  const stepKey = READINESS_STEPS[currentStep]
  const grade = state.student?.grade_entering
  const questionsForGrade = grade ? diagnosticQuestions[grade] || [] : []

  const handleNextStep = () => {
    if (currentStep < READINESS_STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
      setCurrentQuestionIndex(0)
    }
  }

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleParentContextUpdate = (key: keyof ParentContext, value: any) => {
    setState(prev => ({
      ...prev,
      parent: { ...prev.parent, [key]: value },
    }))
  }

  const handleStudentContextUpdate = (key: string, value: any) => {
    setState(prev => ({
      ...prev,
      student: { ...prev.student, [key]: value },
    }))
  }

  const handleIntentUpdate = (key: string, value: any) => {
    setState(prev => ({
      ...prev,
      intent: { ...prev.intent, [key]: value },
    }))
  }

  const handleDiagnosticAnswer = (questionId: string, answer: string) => {
    setState(prev => {
      const newAnswers = [...prev.diagnostic.answers]
      const existingIndex = newAnswers.findIndex(a => a.question_id === questionId)
      if (existingIndex >= 0) {
        newAnswers[existingIndex] = { question_id: questionId, answer }
      } else {
        newAnswers.push({ question_id: questionId, answer })
      }
      return {
        ...prev,
        diagnostic: { ...prev.diagnostic, answers: newAnswers },
      }
    })
  }

  const handleEmailCapture = (email: string, firstName: string, phone?: string, consent?: boolean) => {
    setState(prev => ({
      ...prev,
      parent: { ...prev.parent, email, first_name: firstName, phone },
      intent: { ...prev.intent, marketing_consent: consent },
    }))
  }

  const handleBookingRedirect = () => {
    trackAnalytics('booking_clicked', {
      grade: state.student.grade_entering,
      source: state.attribution.source,
      intent_classification: state.intent.classification,
    })
    window.location.href = '/book'
  }

  // Render individual steps
  const renderStep = () => {
    switch (stepKey) {
      case 'intro':
        return (
          <IntroScreen onNext={() => {
            trackAnalytics('readiness_started', {
              source: state.attribution.source,
            })
            handleNextStep()
          }} />
        )

      case 'parent-grade':
        return (
          <ParentGradeQuestion
            value={state.student.grade_entering}
            onChange={(grade) => handleStudentContextUpdate('grade_entering', grade)}
            onNext={handleNextStep}
            onPrevious={handlePrevStep}
          />
        )

      case 'parent-performance':
        return (
          <ParentPerformanceQuestion
            value={state.student.recent_math_range}
            onChange={(range) => handleStudentContextUpdate('recent_math_range', range)}
            onNext={handleNextStep}
            onPrevious={handlePrevStep}
          />
        )

      case 'parent-concerns':
        return (
          <ParentConcernsQuestion
            value={state.student.concerns || []}
            onChange={(concerns) => handleStudentContextUpdate('concerns', concerns)}
            onNext={handleNextStep}
            onPrevious={handlePrevStep}
          />
        )

      case 'parent-profile':
        return (
          <ParentProfileQuestion
            value={state.student.learning_profile}
            onChange={(profile) => handleStudentContextUpdate('learning_profile', profile)}
            onNext={handleNextStep}
            onPrevious={handlePrevStep}
          />
        )

      case 'parent-goals':
        return (
          <ParentGoalsQuestion
            value={state.student.primary_goal}
            onChange={(goal) => handleStudentContextUpdate('primary_goal', goal)}
            onNext={handleNextStep}
            onPrevious={handlePrevStep}
          />
        )

      case 'parent-intent':
        return (
          <ParentIntentQuestion
            value={state.intent.support_intent}
            onChange={(intent) => handleIntentUpdate('support_intent', intent)}
            onNext={() => {
              trackAnalytics('parent_context_completed', {
                grade: state.student.grade_entering,
                source: state.attribution.source,
              })
              handleNextStep()
            }}
            onPrevious={handlePrevStep}
          />
        )

      case 'diagnostic-intro':
        return (
          <DiagnosticIntro
            onStart={() => {
              trackAnalytics('diagnostic_started', {
                grade: state.student.grade_entering,
                source: state.attribution.source,
              })
              handleNextStep()
            }}
            onSkip={handleBookingRedirect}
          />
        )

      case 'diagnostic-questions':
        if (!questionsForGrade.length) {
          return (
            <div className="text-center py-12">
              <p className="text-gray-600">No questions available for this grade yet.</p>
              <button
                onClick={handleNextStep}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                Continue
              </button>
            </div>
          )
        }
        return (
          <DiagnosticQuestionsFlow
            questions={questionsForGrade}
            answers={state.diagnostic.answers}
            currentIndex={currentQuestionIndex}
            grade={grade!}
            onAnswer={handleDiagnosticAnswer}
            onNext={() => {
              if (currentQuestionIndex < questionsForGrade.length - 1) {
                setCurrentQuestionIndex(currentQuestionIndex + 1)
              } else {
                trackAnalytics('diagnostic_completed', {
                  grade: state.student.grade_entering,
                  source: state.attribution.source,
                  questions_answered: state.diagnostic.answers.length,
                })
                handleNextStep()
              }
            }}
            onPrev={() => {
              if (currentQuestionIndex > 0) {
                setCurrentQuestionIndex(currentQuestionIndex - 1)
              }
            }}
          />
        )

      case 'email-capture':
        return (
          <EmailCaptureScreen
            onSubmit={(email, firstName, phone, consent) => {
              handleEmailCapture(email, firstName, phone, consent)
              trackAnalytics('lead_captured', {
                grade: state.student.grade_entering,
                source: state.attribution.source,
              })
              handleNextStep()
            }}
            isLoading={isLoading}
          />
        )

      case 'results':
        const analysisResult = analyzeReadiness(state)
        return (
          <ResultsScreen
            analysis={analysisResult}
            grade={grade!}
            onContinue={() => {
              trackAnalytics('results_viewed', {
                grade: state.student.grade_entering,
                source: state.attribution.source,
                overall_readiness: analysisResult.overallReadiness,
                classification: analysisResult.classification,
              })
              handleNextStep()
            }}
          />
        )

      case 'next-step':
        const analysis = analyzeReadiness(state)
        return (
          <NextStepScreen
            analysis={analysis}
            intent={state.intent.support_intent}
            onViewResources={() => {
              trackAnalytics('resource_clicked', {
                grade: state.student.grade_entering,
                source: state.attribution.source,
              })
              window.location.href = '/resources'
            }}
            onViewOffer={() => {
              trackAnalytics('offer_clicked', {
                grade: state.student.grade_entering,
                source: state.attribution.source,
                analysis_classification: analysis.classification,
              })
              window.location.href = '/'
            }}
            onBook={handleBookingRedirect}
          />
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header with logo/branding */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="text-sm text-gray-600">Infinite Solutions Tutoring</div>
        </div>
      </div>

      {/* Progress indicator (hide on intro) */}
      {stepKey !== 'intro' && stepKey !== 'results' && stepKey !== 'next-step' && (
        <ProgressIndicator
          currentStep={currentStep}
          totalSteps={READINESS_STEPS.length}
        />
      )}

      {/* Main content */}
      <div className="max-w-2xl mx-auto px-4 py-8 pb-20">
        {renderStep()}
      </div>
    </div>
  )
}

// ============================================================================
// SCREEN COMPONENTS
// ============================================================================

function IntroScreen({ onNext }: { onNext: () => void }) {
  return (
    <div className="py-12">
      <div className="max-w-3xl mx-auto">
        {/* Main heading */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Is Your Child Ready for September Math?
          </h1>
          <p className="text-xl text-gray-700 max-w-2xl mx-auto">
            Get a clear picture of where your child stands before the new school year starts. No surprises—just clarity.
          </p>
        </div>

        {/* How it works */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-8 mb-12 border border-blue-200">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Here's what you'll get:</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg mx-auto mb-3">
                1
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Quick Context</h3>
              <p className="text-sm text-gray-700">Tell us about your child's background (5 minutes)</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg mx-auto mb-3">
                2
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Math Snapshot</h3>
              <p className="text-sm text-gray-700">Answer ~10 targeted math questions (3 minutes)</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg mx-auto mb-3">
                3
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Your Results</h3>
              <p className="text-sm text-gray-700">See readiness & priority skills to focus on</p>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="space-y-4 mb-12">
          <div className="flex items-start gap-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <span className="text-green-600 text-2xl flex-shrink-0">✓</span>
            <div>
              <p className="font-semibold text-gray-900">Identify possible skill gaps</p>
              <p className="text-sm text-gray-700">Know exactly what may need reinforcement</p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-blue-600 text-2xl flex-shrink-0">✓</span>
            <div>
              <p className="font-semibold text-gray-900">Get personalized recommendations</p>
              <p className="text-sm text-gray-700">Know exactly what to focus on this summer</p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <span className="text-purple-600 text-2xl flex-shrink-0">✓</span>
            <div>
              <p className="font-semibold text-gray-900">Zero obligation</p>
              <p className="text-sm text-gray-700">Completely free. No sign-up required to see results.</p>
            </div>
          </div>
        </div>

        {/* CTA buttons */}
        <div className="space-y-4 mb-8">
          <button
            onClick={onNext}
            className="w-full px-8 py-5 bg-blue-600 text-white text-lg font-bold rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-lg"
          >
            Start the Free Readiness Check
            <ChevronRight size={22} />
          </button>

          <div className="text-center text-sm text-gray-600">
            ⏱️ Takes about 8 minutes
          </div>
        </div>

        {/* Alternative CTA */}
        <div className="border-t border-gray-200 pt-8">
          <p className="text-gray-700 mb-4 font-medium">Already know you want tutoring?</p>
          <a
            href="/book"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold text-lg"
          >
            Skip to booking
            <ChevronRight size={20} />
          </a>
        </div>
      </div>
    </div>
  )
}

function ParentGradeQuestion({
  value,
  onChange,
  onNext,
  onPrevious,
}: {
  value?: number
  onChange: (grade: number) => void
  onNext: () => void
  onPrevious: () => void
}) {
  return (
    <ParentQuestion
      number={1}
      question="What grade is your child entering?"
      options={[6, 7, 8, 9, 10, 11, 12].map(g => ({
        label: `Grade ${g}`,
        value: g,
      }))}
      value={value}
      onChange={onChange}
      onNext={onNext}
      onPrevious={onPrevious}
    />
  )
}

function ParentPerformanceQuestion({
  value,
  onChange,
  onNext,
  onPrevious,
}: {
  value?: string
  onChange: (range: string) => void
  onNext: () => void
  onPrevious: () => void
}) {
  return (
    <ParentQuestion
      number={2}
      question="Approximately where was their most recent math grade?"
      options={[
        { label: '90%+', value: '90+' },
        { label: '80–89%', value: '80-89' },
        { label: '70–79%', value: '70-79' },
        { label: '60–69%', value: '60-69' },
        { label: 'Below 60%', value: 'below-60' },
        { label: "I'm not sure", value: 'not-sure' },
      ]}
      value={value}
      onChange={onChange}
      onNext={onNext}
      onPrevious={onPrevious}
    />
  )
}

function ParentConcernsQuestion({
  value,
  onChange,
  onNext,
  onPrevious,
}: {
  value: string[]
  onChange: (concerns: string[]) => void
  onNext: () => void
  onPrevious: () => void
}) {
  const options = [
    'Gaps from last year',
    'Homework becoming difficult',
    'Tests and assessments',
    'Confidence with math',
    'Preparing for September',
    'Getting ahead',
    'A specific upcoming course',
    "I'm not sure what the problem is",
  ]

  const progress = (3 / 6) * 100

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm text-blue-600 font-semibold">Question 3 of 6</h2>
          <span className="text-xs text-gray-500">{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question card */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 mb-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">What are you most concerned about?</h3>
        <p className="text-gray-600 mb-8">Select up to 2</p>

        <div className="grid grid-cols-1 gap-3">
          {options.map((option, idx) => (
            <label
              key={option}
              className={`flex items-start gap-4 p-4 border-2 rounded-lg cursor-pointer transition ${
                value.includes(option)
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300 bg-white hover:bg-gray-50'
              } ${!value.includes(option) && value.length >= 2 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input
                type="checkbox"
                checked={value.includes(option)}
                onChange={(e) => {
                  if (e.target.checked && value.length < 2) {
                    onChange([...value, option])
                  } else if (!e.target.checked) {
                    onChange(value.filter(v => v !== option))
                  }
                }}
                className="w-5 h-5 mt-0.5 text-blue-600 rounded cursor-pointer flex-shrink-0"
                disabled={!value.includes(option) && value.length >= 2}
              />
              <span className={`font-medium ${value.includes(option) ? 'text-gray-900' : 'text-gray-700'}`}>
                {option}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Selection indicator */}
      {value.length > 0 && (
        <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">{value.length}</span> of 2 selected
          </p>
        </div>
      )}

      <QuestionNavigation
        onPrevious={onPrevious}
        onNext={onNext}
        nextDisabled={value.length === 0}
      />
    </div>
  )
}

function ParentProfileQuestion({
  value,
  onChange,
  onNext,
  onPrevious,
}: {
  value?: string
  onChange: (profile: string) => void
  onNext: () => void
  onPrevious: () => void
}) {
  return (
    <ParentQuestion
      number={4}
      question="Which statement best describes your child?"
      options={[
        { label: 'Usually strong and independent', value: 'strong-independent' },
        {
          label: 'Generally understands but needs occasional help',
          value: 'understands-occasional-help',
        },
        {
          label: 'Understands during instruction but struggles independently',
          value: 'struggles-independently',
        },
        {
          label: 'Has noticeable gaps between topics',
          value: 'noticeable-gaps',
        },
        {
          label: 'Math has become an ongoing struggle',
          value: 'ongoing-struggle',
        },
        { label: "I'm not sure", value: 'not-sure' },
      ]}
      value={value}
      onChange={onChange}
      onNext={onNext}
      onPrevious={onPrevious}
    />
  )
}

function ParentGoalsQuestion({
  value,
  onChange,
  onNext,
  onPrevious,
}: {
  value?: string
  onChange: (goal: string) => void
  onNext: () => void
  onPrevious: () => void
}) {
  return (
    <ParentQuestion
      number={5}
      question="What would you most like to achieve?"
      options={[
        { label: 'Catch up', value: 'catch-up' },
        { label: 'Start September prepared', value: 'september-prepared' },
        { label: 'Improve their math grade', value: 'improve-grade' },
        { label: 'Build confidence', value: 'build-confidence' },
        { label: 'Stay ahead', value: 'stay-ahead' },
        { label: 'Prepare for a specific course', value: 'prepare-course' },
        { label: 'Understand where the gaps are', value: 'understand-gaps' },
      ]}
      value={value}
      onChange={onChange}
      onNext={onNext}
      onPrevious={onPrevious}
    />
  )
}

function ParentIntentQuestion({
  value,
  onChange,
  onNext,
  onPrevious,
}: {
  value?: string
  onChange: (intent: string) => void
  onNext: () => void
  onPrevious: () => void
}) {
  return (
    <ParentQuestion
      number={6}
      question="What kind of support are you currently considering?"
      options={[
        { label: "I'm mainly looking for free resources", value: 'free-resources' },
        {
          label: "I'd like to understand where the gaps are first",
          value: 'understand-gaps-first',
        },
        { label: 'We may want occasional tutoring', value: 'occasional' },
        { label: "We're looking for weekly tutoring", value: 'weekly' },
        { label: "We're looking for ongoing support throughout the semester", value: 'ongoing' },
      ]}
      value={value}
      onChange={onChange}
      onNext={onNext}
      onPrevious={onPrevious}
    />
  )
}

function ParentQuestion({
  number,
  question,
  options,
  value,
  onChange,
  onNext,
  onPrevious,
}: {
  number: number
  question: string
  options: Array<{ label: string; value: any }>
  value?: any
  onChange: (value: any) => void
  onNext: () => void
  onPrevious: () => void
}) {
  const progress = (number / 6) * 100

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress bar inside card */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm text-blue-600 font-semibold">Question {number} of 6</h2>
          <span className="text-xs text-gray-500">{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question card */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 mb-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-8">{question}</h3>

        {/* Options */}
        <div className="space-y-3">
          {options.map((option, idx) => (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={`w-full p-4 text-left border-2 rounded-lg transition font-medium flex items-center gap-4 ${
                value === option.value
                  ? 'border-blue-600 bg-blue-50 text-gray-900'
                  : 'border-gray-200 hover:border-blue-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {/* Option number indicator */}
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  value === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {String.fromCharCode(65 + idx)}
              </div>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      <QuestionNavigation
        onPrevious={onPrevious}
        onNext={onNext}
        nextDisabled={value === undefined || value === null}
      />
    </div>
  )
}

function QuestionNavigation({
  onPrevious,
  onNext,
  nextDisabled,
}: {
  onPrevious: () => void
  onNext: () => void
  nextDisabled: boolean
}) {
  return (
    <div className="flex gap-4">
      <button
        type="button"
        onClick={onPrevious}
        className="px-5 py-4 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:border-gray-400 transition flex items-center justify-center gap-2"
      >
        <ChevronLeft size={20} />
        Previous
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="flex-1 px-6 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
      >
        Next
        <ChevronRight size={20} />
      </button>
    </div>
  )
}

function DiagnosticIntro({
  onStart,
  onSkip,
}: {
  onStart: () => void
  onSkip: () => void
}) {
  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Next, let's check a few key math skills.
          </h2>
          <p className="text-lg text-gray-700">
            This is <span className="font-semibold">not a test</span>. We're just taking a quick snapshot of where review might be helpful.
          </p>
        </div>

        {/* Info boxes */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-blue-900 mb-1">📝 About 10 questions</p>
            <p className="text-sm text-blue-800">Focused on skills for this grade level</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-purple-900 mb-1">⏱️ About 3 minutes</p>
            <p className="text-sm text-purple-800">Quick and straightforward</p>
          </div>
        </div>

        {/* CTAs */}
        <div className="space-y-3">
          <button
            onClick={onStart}
            className="w-full px-6 py-4 bg-blue-600 text-white font-bold text-lg rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-lg"
          >
            Start the Math Questions
            <ChevronRight size={20} />
          </button>
          <button
            onClick={onSkip}
            className="w-full px-6 py-4 border-2 border-gray-300 text-gray-700 font-semibold text-lg rounded-lg hover:bg-gray-50 transition"
          >
            Skip to Booking
          </button>
        </div>

        {/* Reassurance */}
        <p className="text-center text-sm text-gray-600 mt-6">
          Your answers help us understand where to focus. There's no passing or failing.
        </p>
      </div>
    </div>
  )
}

function DiagnosticQuestionsFlow({
  questions,
  answers,
  currentIndex,
  grade,
  onAnswer,
  onNext,
  onPrev,
}: {
  questions: any[]
  answers: DiagnosticAnswer[]
  currentIndex: number
  grade: number
  onAnswer: (questionId: string, answer: string) => void
  onNext: () => void
  onPrev: () => void
}) {
  const currentQuestion = questions[currentIndex]
  const currentAnswer = answers.find(a => a.question_id === currentQuestion.id)?.answer

  if (!currentQuestion) {
    return null
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="text-sm text-gray-600 mb-4">
          Question {currentIndex + 1} of {questions.length}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="mb-8">
        <div className="text-xs text-blue-600 font-semibold mb-3">
          {currentQuestion.skill}
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-8">{currentQuestion.prompt}</h3>

        <div className="space-y-3 mb-8">
          {currentQuestion.type === 'multiple-choice' ? (
            <>
              {currentQuestion.options.map((option: string) => (
                <button
                  key={option}
                  onClick={() => onAnswer(currentQuestion.id, option)}
                  className={`w-full p-4 text-left border-2 rounded-lg transition font-medium ${
                    currentAnswer === option
                      ? 'border-blue-600 bg-blue-50 text-gray-900'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  {option}
                </button>
              ))}
              <button
                onClick={() => onAnswer(currentQuestion.id, 'not-sure')}
                className={`w-full p-4 text-left border-2 rounded-lg transition font-medium ${
                  currentAnswer === 'not-sure'
                    ? 'border-gray-400 bg-gray-50 text-gray-900'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                I'm not sure
              </button>
            </>
          ) : (
            <input
              type="text"
              value={currentAnswer || ''}
              onChange={(e) => onAnswer(currentQuestion.id, e.target.value)}
              placeholder="Enter your answer"
              className="w-full p-4 border-2 border-gray-200 rounded-lg bg-white text-black placeholder:text-black focus:border-blue-600 focus:outline-none"
            />
          )}
        </div>
      </div>

      <div className="flex gap-4">
        {currentIndex > 0 && (
          <button
            onClick={onPrev}
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:border-gray-400 transition flex items-center gap-2"
          >
            <ChevronLeft size={18} />
            Previous
          </button>
        )}
        <button
          onClick={onNext}
          disabled={!currentAnswer}
          className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          Next
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}

function EmailCaptureScreen({
  onSubmit,
  isLoading,
}: {
  onSubmit: (email: string, firstName: string, phone?: string, consent?: boolean) => void
  isLoading: boolean
}) {
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(true)

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="bg-white rounded-xl border border-gray-200 p-8 md:p-12">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✓</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Great! Your assessment is complete.</h2>
          <p className="text-gray-700">
            Get your personalized results and recommendations sent to your email.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit(email, firstName, phone, consent)
          }}
          className="space-y-6 mb-8"
        >
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">Your First Name *</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Sarah"
              required
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg bg-white text-black placeholder:text-black focus:border-blue-600 focus:outline-none transition text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">Email Address *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg bg-white text-black placeholder:text-black focus:border-blue-600 focus:outline-none transition text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">Phone (optional)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="416-555-1234"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg bg-white text-black placeholder:text-black focus:border-blue-600 focus:outline-none transition text-base"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="w-5 h-5 mt-1 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700">
                <span className="font-semibold block mb-1">Stay in touch</span>
                Yes, I'd like to receive tips, updates, and resources from Infinite Solutions Tutoring.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading || !email || !firstName}
            className="w-full px-6 py-4 bg-blue-600 text-white font-bold text-lg rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? 'Sending...' : 'View My Results'}
            {!isLoading && <ChevronRight size={20} />}
          </button>
        </form>

        <p className="text-xs text-gray-500 text-center">
          We respect your privacy. No spam, ever. Unsubscribe anytime.
        </p>
      </div>
    </div>
  )
}

function ResultsScreen({
  analysis,
  grade,
  onContinue,
}: {
  analysis: any
  grade: number
  onContinue: () => void
}) {
  const getReadinessColor = (percentage: number) => {
    if (percentage >= 80) return 'from-green-100 to-green-50 border-green-300'
    if (percentage >= 60) return 'from-yellow-100 to-yellow-50 border-yellow-300'
    return 'from-orange-100 to-orange-50 border-orange-300'
  }

  const getReadinessEmoji = (percentage: number) => {
    if (percentage >= 80) return '🌟'
    if (percentage >= 60) return '👍'
    return '📚'
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-gray-900 mb-3">Your September Math Readiness</h2>
        <p className="text-lg text-gray-700">
          Based on your answers, here's where your child stands
        </p>
      </div>

      {/* Overall readiness - Premium card */}
      <div className={`bg-gradient-to-br ${getReadinessColor(analysis.overallReadiness)} border-2 rounded-2xl p-10 md:p-12 mb-12`}>
        <div className="text-center">
          <div className="text-6xl mb-4">{getReadinessEmoji(analysis.overallReadiness)}</div>
          <p className="text-gray-700 text-lg mb-2">Overall Readiness Score</p>
          <div className="text-7xl font-bold text-gray-900 mb-4">{analysis.overallReadiness}%</div>
          <div className="inline-block px-6 py-2 bg-white bg-opacity-70 rounded-full">
            <p className="font-bold text-lg text-gray-900">{analysis.classification}</p>
          </div>
        </div>
      </div>

      {/* Skill breakdown */}
      <div className="mb-12">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Skills Assessed</h3>
        <p className="text-gray-600 mb-8">Grade {grade} readiness for the following areas:</p>
        
        <div className="space-y-6">
          {Object.entries(analysis.skillBreakdown).map(([skill, data]: [string, any]) => {
            const statusColor = data.status === 'Strong' ? 'text-green-600' :
                               data.status === 'Review' ? 'text-yellow-600' :
                               'text-orange-600'
            const barColor = data.status === 'Strong' ? 'bg-green-500' :
                            data.status === 'Review' ? 'bg-yellow-500' :
                            'bg-orange-500'
            
            return (
              <div key={skill} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-gray-900 text-lg">{skill}</h4>
                    <p className={`text-sm font-semibold ${statusColor}`}>{data.status}</p>
                  </div>
                  {data.percentage !== undefined && (
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">{data.percentage}%</p>
                      <p className="text-xs text-gray-600">({data.questionsCorrect}/{data.questionsAttempted})</p>
                    </div>
                  )}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                  <div
                    className={`${barColor} h-3 rounded-full transition-all`}
                    style={{ width: `${data.percentage || 0}%` }}
                  />
                </div>
                <p className="text-sm text-gray-700">{data.recommendation}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top priorities */}
      {analysis.prioritySkills.length > 0 && (
        <div className="mb-12 bg-blue-50 border border-blue-200 rounded-2xl p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4">📌 Top Areas to Focus On</h3>
          <ul className="space-y-3">
            {analysis.prioritySkills.slice(0, 3).map((skill: string, idx: number) => (
              <li key={skill} className="flex items-start gap-3">
                <span className="font-bold text-blue-600 mt-1">{idx + 1}.</span>
                <span className="text-gray-900 font-medium">{skill}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Disclaimer */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-8">
        <p className="text-sm text-gray-700">
          <span className="font-semibold">📋 Important note:</span> This readiness check is a starting point to understand areas worth reviewing. It doesn't replace a full curriculum assessment. 
        </p>
      </div>

      <button
        onClick={onContinue}
        className="w-full px-6 py-5 bg-blue-600 text-white font-bold text-lg rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-lg"
      >
        See Your Next Step
        <ChevronRight size={22} />
      </button>
    </div>
  )
}

function NextStepScreen({
  analysis,
  intent,
  onViewResources,
  onViewOffer,
  onBook,
}: {
  analysis: any
  intent?: string
  onViewResources: () => void
  onViewOffer: () => void
  onBook: () => void
}) {
  // Determine which path to show based on intent and academic need
  const highIntent = ['weekly', 'ongoing'].includes(intent ?? '')
  const lowIntent = intent === 'free-resources'
  const warmIntent = !highIntent && !lowIntent

  return (
    <div className="max-w-2xl mx-auto py-8">
      {lowIntent ? (
        <>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Here's where we'd start.</h2>
            <p className="text-gray-700 mb-8">
              Check out our free resources and join the parent community for ongoing tips and support.
            </p>
          </div>

          <div className="space-y-4 mb-12">
            <button
              onClick={onViewResources}
              className="w-full px-6 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              View Free Resources
              <ChevronRight size={20} />
            </button>
            <button
              onClick={() => window.location.href = '#'}
              className="w-full px-6 py-4 border-2 border-blue-600 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition"
            >
              Join Parent Community
            </button>
          </div>

          <div className="border-t border-gray-200 pt-8">
            <p className="text-gray-700 mb-4">Want more personalized help?</p>
            <button
              onClick={onViewOffer}
              className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-2"
            >
              View tutoring options
              <ChevronRight size={18} />
            </button>
          </div>
        </>
      ) : warmIntent ? (
        <>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">A more detailed review may be helpful.</h2>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-8 mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-3">September Math Ready — Private</h3>
            <p className="text-gray-700 mb-4">
              Go beyond this quick snapshot with a personalized 1-on-1 assessment, targeted instruction, practice, and a September plan.
            </p>
            <div className="text-3xl font-bold text-blue-600 mb-6">$149 + HST</div>

            <button
              onClick={onViewOffer}
              className="w-full px-6 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 mb-3"
            >
              See September Math Ready
              <ChevronRight size={20} />
            </button>

            <button
              onClick={onBook}
              className="w-full px-6 py-4 border-2 border-blue-600 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition"
            >
              Book Now
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready for more personalized support?</h2>
            <p className="text-gray-700 mb-8">
              Based on what you're looking for, the next step is a personalized session so we can review the gaps in more detail and build a plan.
            </p>
          </div>

          <div className="space-y-4 mb-12">
            <button
              onClick={onBook}
              className="w-full px-6 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              Choose a Session Time
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h3 className="font-bold text-gray-900 mb-2">September Math Ready — Private</h3>
            <p className="text-sm text-gray-700 mb-4">
              1-on-1 assessment, targeted instruction, personalized practice, and September recommendations.
            </p>
            <p className="text-2xl font-bold text-blue-600">$149 + HST</p>
          </div>
        </>
      )}
    </div>
  )
}

function ProgressIndicator({
  currentStep,
  totalSteps,
}: {
  currentStep: number
  totalSteps: number
}) {
  const progress = ((currentStep / totalSteps) * 100)
  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs text-gray-600 font-semibold">STEP {currentStep} OF {totalSteps}</span>
          <span className="text-xs text-gray-600">{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div
            className="bg-blue-600 h-1.5 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
