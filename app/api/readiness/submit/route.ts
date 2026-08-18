import { NextResponse } from 'next/server'
import type { AnalysisResult } from '../../../readiness/lib/analysis-engine'
import {
  calculatePurchaseIntentScore,
  classifyLead,
  generateLeadSummary,
} from '../../../readiness/lib/analytics'
import type { ReadinessState } from '../../../readiness/types/readiness'

const ASSESSMENT_RECIPIENT = 'karyshane1@gmail.com'
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

type SubmissionBody = {
  assessment?: ReadinessState
  analysis?: AnalysisResult
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function display(value: unknown): string {
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  return value === undefined || value === null || value === '' ? '—' : String(value)
}

function row(label: string, value: unknown): string {
  return `<tr><th style="padding:8px 12px;text-align:left;border-bottom:1px solid #e7eaf0;color:#526071;font-weight:600;vertical-align:top">${escapeHtml(label)}</th><td style="padding:8px 12px;border-bottom:1px solid #e7eaf0;color:#101828">${escapeHtml(display(value))}</td></tr>`
}

type LeadScoring = {
  leadScore: number
  purchaseIntentScore: number
  classification: ReturnType<typeof classifyLead>
  summary: string
}

function calculateLeadScoring(assessment: ReadinessState, analysis: AnalysisResult): LeadScoring {
  const purchaseIntentScore = calculatePurchaseIntentScore(assessment.intent.support_intent)
  const classification = classifyLead(analysis.academicNeedScore, purchaseIntentScore)
  const leadScore = Math.round(
    (purchaseIntentScore / 12) * 70 + (analysis.academicNeedScore / 100) * 30
  )

  return {
    leadScore,
    purchaseIntentScore,
    classification,
    summary: generateLeadSummary(
      analysis.academicNeedScore,
      purchaseIntentScore,
      classification
    ),
  }
}

function buildAssessmentEmail(
  assessment: ReadinessState,
  analysis: AnalysisResult,
  lead: LeadScoring
): string {
  const answerRows = assessment.diagnostic.answers
    .map(answer => row(answer.question_id, answer.answer))
    .join('')

  const skillRows = Object.values(analysis.skillBreakdown)
    .map(skill => row(skill.skill, `${skill.percentage ?? 0}% — ${skill.status}`))
    .join('')

  return `
    <div style="background:#f8fafb;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#101828">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e7eaf0;border-radius:16px;padding:32px">
        <h1 style="margin:0 0 8px;font-size:26px;line-height:1.2">New Math Readiness Assessment</h1>
        <p style="margin:0 0 24px;color:#526071">A completed assessment was submitted through readiness.privatetutoring.ca.</p>

        <div style="margin:0 0 24px;padding:20px;background:#eef8f7;border:1px solid #dce9e8;border-radius:12px">
          <p style="margin:0 0 4px;color:#526071;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.08em">Lead score</p>
          <p style="margin:0;color:#101828;font-size:36px;font-weight:700;line-height:1">${lead.leadScore}<span style="font-size:16px;color:#526071">/100</span></p>
          <p style="margin:10px 0 0;color:#146b70;font-weight:700">${escapeHtml(lead.classification)}</p>
          <p style="margin:4px 0 0;color:#526071">${escapeHtml(lead.summary)}</p>
        </div>

        <h2 style="margin:24px 0 8px;font-size:18px">Lead details</h2>
        <table style="width:100%;border-collapse:collapse">
          ${row('Lead score', `${lead.leadScore}/100`)}
          ${row('Lead classification', lead.classification)}
          ${row('Purchase intent score', `${lead.purchaseIntentScore}/12`)}
          ${row('Academic need score', `${analysis.academicNeedScore}/100`)}
          ${row('Lead summary', lead.summary)}
        </table>

        <h2 style="margin:24px 0 8px;font-size:18px">Contact and context</h2>
        <table style="width:100%;border-collapse:collapse">
          ${row('Parent name', assessment.parent.first_name)}
          ${row('Parent email', assessment.parent.email)}
          ${row('Phone', assessment.parent.phone)}
          ${row('Marketing consent', assessment.intent.marketing_consent)}
          ${row('Grade entering', assessment.student.grade_entering)}
          ${row('Recent math range', assessment.student.recent_math_range)}
          ${row('Concerns', assessment.student.concerns)}
          ${row('Learning profile', assessment.student.learning_profile)}
          ${row('Primary goal', assessment.student.primary_goal)}
          ${row('Support intent', assessment.intent.support_intent)}
        </table>

        <h2 style="margin:24px 0 8px;font-size:18px">Results</h2>
        <table style="width:100%;border-collapse:collapse">
          ${row('Overall readiness', `${analysis.overallReadiness}%`)}
          ${row('Classification', analysis.classification)}
          ${row('Priority skills', analysis.prioritySkills)}
          ${skillRows}
        </table>

        <h2 style="margin:24px 0 8px;font-size:18px">Diagnostic answers</h2>
        <table style="width:100%;border-collapse:collapse">${answerRows}</table>

        <h2 style="margin:24px 0 8px;font-size:18px">Attribution</h2>
        <table style="width:100%;border-collapse:collapse">
          ${row('Source', assessment.attribution.source)}
          ${row('UTM source', assessment.attribution.utm_source)}
          ${row('UTM medium', assessment.attribution.utm_medium)}
          ${row('UTM campaign', assessment.attribution.utm_campaign)}
        </table>
      </div>
    </div>
  `
}

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('RESEND_API_KEY is not configured')
    return NextResponse.json({ error: 'Email service is not configured' }, { status: 503 })
  }

  let body: SubmissionBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const assessment = body.assessment
  const analysis = body.analysis
  if (!assessment?.parent?.email || !assessment.student?.grade_entering || !analysis) {
    return NextResponse.json({ error: 'Incomplete assessment' }, { status: 400 })
  }

  const from = process.env.READINESS_FROM_EMAIL || 'Infinite Solutions Tutoring <onboarding@resend.dev>'
  const lead = calculateLeadScoring(assessment, analysis)
  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [ASSESSMENT_RECIPIENT],
      reply_to: assessment.parent.email,
      subject: `[${lead.classification}] Lead ${lead.leadScore}/100 — Grade ${assessment.student.grade_entering} — ${assessment.parent.first_name || assessment.parent.email}`,
      html: buildAssessmentEmail(assessment, analysis, lead),
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Resend assessment email failed:', response.status, error)
    return NextResponse.json({ error: 'Assessment email failed' }, { status: 502 })
  }

  const result = await response.json()
  return NextResponse.json({ success: true, id: result.id })
}
