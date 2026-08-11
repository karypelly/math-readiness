import { diagnosticQuestions } from '../data/diagnostic-questions'
import type { ReadinessState } from '../types/readiness'

export interface SkillResult {
  skill: string
  questionsAttempted: number
  questionsCorrect: number
  percentage?: number
  status: 'Strong' | 'Review' | 'Priority Review'
  recommendation: string
}

export interface AnalysisResult {
  overallReadiness: number
  classification: 'LOOKS SOLID' | 'SOME REVIEW RECOMMENDED' | 'IMPORTANT GAPS IDENTIFIED'
  skillBreakdown: Record<string, SkillResult>
  prioritySkills: string[]
  academicNeedScore: number
  recommendations: string[]
}

const THRESHOLDS = {
  strong: 80, // >= 80%
  review: 60, // 60-79%
  priorityReview: 0, // < 60%
}

const CLASSIFICATION_THRESHOLDS = {
  looksSolid: 80,
  someReview: 60,
}

export function analyzeReadiness(state: ReadinessState): AnalysisResult {
  const grade = state.student?.grade_entering
  if (!grade) {
    return getDefaultAnalysis()
  }

  const questions = diagnosticQuestions[grade] || []
  const answers = state.diagnostic?.answers || []

  // Build a skill-based results map
  const skillResults: Record<string, { skill: string; correct: number; total: number; questions: any[] }> = {}

  questions.forEach(question => {
    if (!skillResults[question.skill]) {
      skillResults[question.skill] = {
        skill: question.skill,
        correct: 0,
        total: 0,
        questions: [],
      }
    }
    skillResults[question.skill].total++
    skillResults[question.skill].questions.push(question)

    // Check if answer is correct
    const answer = answers.find(a => a.question_id === question.id)
    if (answer && isAnswerCorrect(answer.answer, question.correctAnswer)) {
      skillResults[question.skill].correct++
    }
  })

  // Convert to SkillResult format
  const skillBreakdown: Record<string, SkillResult> = {}
  Object.entries(skillResults).forEach(([skillName, data]) => {
    const percentage = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0
    const status = getSkillStatus(percentage, data.total)
    const recommendation = getSkillRecommendation(skillName, status)

    skillBreakdown[skillName] = {
      skill: skillName,
      questionsAttempted: data.total,
      questionsCorrect: data.correct,
      percentage: data.total > 1 ? percentage : undefined,
      status,
      recommendation,
    }
  })

  // Calculate overall readiness
  const totalAnswered = answers.length
  const totalCorrect = answers.filter(a => {
    const question = questions.find(q => q.id === a.question_id)
    return question && isAnswerCorrect(a.answer, question.correctAnswer)
  }).length

  const overallReadiness = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0

  // Classification
  const classification = getOverallClassification(overallReadiness)

  // Priority skills (lowest performing)
  const prioritySkills = Object.entries(skillBreakdown)
    .filter(([_, result]) => result.status !== 'Strong')
    .sort((a, b) => (a[1].percentage || 0) - (b[1].percentage || 0))
    .slice(0, 4)
    .map(([skillName]) => skillName)

  // Academic need score (0-100)
  const academicNeedScore = calculateAcademicNeedScore(overallReadiness, classification)

  // Recommendations
  const recommendations = generateRecommendations(overallReadiness, state, prioritySkills)

  return {
    overallReadiness,
    classification,
    skillBreakdown,
    prioritySkills,
    academicNeedScore,
    recommendations,
  }
}

function isAnswerCorrect(given: string, correct: string): boolean {
  if (given === 'not-sure' || given === 'skipped' || !given) {
    return false
  }

  // For numeric answers, normalize comparison
  const normalizeNumeric = (str: string) => {
    return str.toLowerCase().replace(/\s+/g, '').replace(/x\^/g, 'x')
  }

  return normalizeNumeric(given) === normalizeNumeric(correct)
}

function getSkillStatus(
  percentage: number,
  questionsAsked: number
): 'Strong' | 'Review' | 'Priority Review' {
  // If only one question, use qualitative assessment
  if (questionsAsked === 1) {
    if (percentage >= 100) return 'Strong'
    if (percentage > 0) return 'Review'
    return 'Priority Review'
  }

  if (percentage >= THRESHOLDS.strong) {
    return 'Strong'
  } else if (percentage >= THRESHOLDS.review) {
    return 'Review'
  } else {
    return 'Priority Review'
  }
}

function getSkillRecommendation(skill: string, status: 'Strong' | 'Review' | 'Priority Review'): string {
  const recommendations: Record<string, Record<string, string>> = {
    'Number Sense': {
      Strong: 'The assessed number sense prerequisites look solid.',
      Review: 'Basic place value and estimation appear worth reinforcing.',
      'Priority Review': 'Number sense foundations may need focused attention before September.',
    },
    Fractions: {
      Strong: 'Fraction concepts look well-understood.',
      Review: 'Fraction operations and equivalence appear worth reviewing.',
      'Priority Review': 'Fractions are critical—focused review recommended before September.',
    },
    Decimals: {
      Strong: 'Decimal understanding looks solid.',
      Review: 'Decimal place value and operations appear worth reviewing.',
      'Priority Review': 'Decimal concepts need focused attention before September.',
    },
    Percent: {
      Strong: 'Percent concepts are well-understood.',
      Review: 'Percent calculations and applications appear worth reviewing.',
      'Priority Review': 'Percent operations need focused review before September.',
    },
    Integers: {
      Strong: 'Integer operations look well-understood.',
      Review: 'Positive and negative integer operations appear worth reinforcing.',
      'Priority Review': 'Integer operations with negatives need focused attention.',
    },
    Algebra: {
      Strong: 'Algebraic thinking appears solid.',
      Review: 'Simplifying expressions and basic algebra appear worth reviewing.',
      'Priority Review': 'Algebraic foundations need focused review before September.',
    },
    Equations: {
      Strong: 'Equation solving looks solid.',
      Review: 'Linear equation solving appears worth reinforcing.',
      'Priority Review': 'Solving equations is critical—focused review recommended.',
    },
    'Linear Relations': {
      Strong: 'Linear relationships are well-understood.',
      Review: 'Graphing and slope concepts appear worth reviewing.',
      'Priority Review': 'Linear relations concepts need focused attention.',
    },
    Exponents: {
      Strong: 'Exponent rules look well-understood.',
      Review: 'Exponent rules and operations appear worth reviewing.',
      'Priority Review': 'Exponent concepts need focused attention.',
    },
    Factoring: {
      Strong: 'Factoring skills appear solid.',
      Review: 'Factoring techniques appear worth reinforcing.',
      'Priority Review': 'Factoring concepts need focused review.',
    },
    Quadratic: {
      Strong: 'Quadratic concepts look solid.',
      Review: 'Quadratic equations and methods appear worth reviewing.',
      'Priority Review': 'Quadratic skills need focused attention.',
    },
    Geometry: {
      Strong: 'Geometry concepts look solid.',
      Review: 'Geometric relationships and properties appear worth reviewing.',
      'Priority Review': 'Geometry foundations need focused attention.',
    },
    Measurement: {
      Strong: 'Measurement concepts are solid.',
      Review: 'Unit conversions and applications appear worth reviewing.',
      'Priority Review': 'Measurement skills need focused review.',
    },
    Data: {
      Strong: 'Data analysis skills look solid.',
      Review: 'Data interpretation appears worth reinforcing.',
      'Priority Review': 'Data concepts need focused attention.',
    },
    'Trigonometry': {
      Strong: 'Trigonometric concepts look solid.',
      Review: 'Trig ratios and angle measures appear worth reviewing.',
      'Priority Review': 'Trigonometry concepts need focused attention.',
    },
    'Systems': {
      Strong: 'Systems of equations look well-understood.',
      Review: 'System solving methods appear worth reinforcing.',
      'Priority Review': 'Systems of equations need focused review.',
    },
    'Sequences': {
      Strong: 'Sequence concepts are solid.',
      Review: 'Sequence patterns and formulas appear worth reviewing.',
      'Priority Review': 'Sequence concepts need focused attention.',
    },
    'Functions': {
      Strong: 'Function concepts look solid.',
      Review: 'Function notation and properties appear worth reviewing.',
      'Priority Review': 'Function fundamentals need focused attention.',
    },
    'Polynomials': {
      Strong: 'Polynomial operations look solid.',
      Review: 'Polynomial operations appear worth reinforcing.',
      'Priority Review': 'Polynomial concepts need focused review.',
    },
    'Logarithms': {
      Strong: 'Logarithmic concepts look solid.',
      Review: 'Logarithm properties appear worth reinforcing.',
      'Priority Review': 'Logarithmic concepts need focused attention.',
    },
    'Exponential': {
      Strong: 'Exponential functions look solid.',
      Review: 'Exponential growth/decay appears worth reviewing.',
      'Priority Review': 'Exponential concepts need focused attention.',
    },
    'Linear Algebra': {
      Strong: 'Linear algebra concepts look solid.',
      Review: 'Matrices and operations appear worth reviewing.',
      'Priority Review': 'Linear algebra concepts need focused attention.',
    },
    'Probability': {
      Strong: 'Probability concepts are solid.',
      Review: 'Probability calculations appear worth reviewing.',
      'Priority Review': 'Probability concepts need focused attention.',
    },
    'Statistics': {
      Strong: 'Statistical concepts look solid.',
      Review: 'Statistical analysis appears worth reviewing.',
      'Priority Review': 'Statistical concepts need focused attention.',
    },
    'Vectors': {
      Strong: 'Vector concepts look solid.',
      Review: 'Vector operations appear worth reinforcing.',
      'Priority Review': 'Vector concepts need focused attention.',
    },
    'Complex Numbers': {
      Strong: 'Complex number concepts look solid.',
      Review: 'Complex operations appear worth reviewing.',
      'Priority Review': 'Complex number concepts need focused attention.',
    },
    'Calculus': {
      Strong: 'Calculus foundations look solid.',
      Review: 'Derivative and limit concepts appear worth reviewing.',
      'Priority Review': 'Calculus fundamentals need focused attention.',
    },
  }

  return (
    recommendations[skill]?.[status] ||
    `The "${skill}" skill appears to be ${status === 'Strong' ? 'solid' : status === 'Review' ? 'worth reinforcing' : 'in need of focused attention'}.`
  )
}

function getOverallClassification(
  percentage: number
): 'LOOKS SOLID' | 'SOME REVIEW RECOMMENDED' | 'IMPORTANT GAPS IDENTIFIED' {
  if (percentage >= CLASSIFICATION_THRESHOLDS.looksSolid) {
    return 'LOOKS SOLID'
  } else if (percentage >= CLASSIFICATION_THRESHOLDS.someReview) {
    return 'SOME REVIEW RECOMMENDED'
  } else {
    return 'IMPORTANT GAPS IDENTIFIED'
  }
}

function calculateAcademicNeedScore(overallReadiness: number, classification: string): number {
  // Score 0-100, where higher = more need for support
  // Inverse of readiness
  const scoreByClassification: Record<string, number> = {
    'LOOKS SOLID': 20,
    'SOME REVIEW RECOMMENDED': 55,
    'IMPORTANT GAPS IDENTIFIED': 85,
  }

  return scoreByClassification[classification] || 50
}

function generateRecommendations(
  overallReadiness: number,
  state: ReadinessState,
  prioritySkills: string[]
): string[] {
  const recommendations: string[] = []

  if (overallReadiness >= 80) {
    recommendations.push('Strong performance on assessed prerequisite skills')
    recommendations.push('Consider using September to get ahead or explore enrichment topics')
  } else if (overallReadiness >= 60) {
    recommendations.push('Some skills appear worth reviewing before September')
    recommendations.push('Targeted practice in weaker areas could build confidence')
  } else {
    recommendations.push('Dedicated review time before September would be beneficial')
    recommendations.push('Focus on the priority skills identified in your results')
  }

  if (prioritySkills.length > 0) {
    recommendations.push(`Priority areas to focus on: ${prioritySkills.slice(0, 2).join(', ')}`)
  }

  // Add recommendation based on stated concerns
  const concerns = state.student?.concerns || []
  if (concerns.includes('Confidence with math')) {
    recommendations.push('Building confidence through success with foundational skills is key')
  }
  if (concerns.includes('Gaps from last year')) {
    recommendations.push('Addressing specific gaps early can prevent compounding challenges')
  }

  return recommendations
}

function getDefaultAnalysis(): AnalysisResult {
  return {
    overallReadiness: 0,
    classification: 'SOME REVIEW RECOMMENDED',
    skillBreakdown: {},
    prioritySkills: [],
    academicNeedScore: 0,
    recommendations: [],
  }
}
