import type { Confidentiality } from '@/types'

/**
 * FOI subject bank. Each entry is a real-world shaped request against HYPREP's
 * remit (Ogoniland remediation, Rivers State) so the prototype reads credibly.
 *
 * Tuple form keeps the seed file compact:
 * [subject, department, tags, confidentiality]
 */
export type SubjectSeed = [string, string, string[], Confidentiality]

export const SUBJECT_SEEDS: SubjectSeed[] = [
  ['Full breakdown of the 2026 remediation capital budget and quarterly drawdowns', 'Finance & Accounts', ['Budget & Expenditure', 'Audit Query'], 'internal'],
  ['List of contractors awarded Phase 2 remediation lots with contract sums', 'Procurement', ['Procurement', 'Contractor Records'], 'confidential'],
  ['Post-remediation soil sampling results for Bodo Creek clean-up sites', 'Remediation & Restoration', ['Remediation', 'Environmental Assessment'], 'public'],
  ['Groundwater hydrocarbon concentration data for Ogale community boreholes', 'Water & Sanitation', ['Water Quality', 'Public Health'], 'public'],
  ['Certificates of completion issued for remediated sites in Gokana LGA', 'Remediation & Restoration', ['Remediation'], 'public'],
  ['Minutes of the HYPREP Governing Council meetings held in 2025', 'Monitoring & Evaluation', ['Audit Query'], 'internal'],
  ['Records of the shoreline clean-up contract at K-Dere and B-Dere', 'Procurement', ['Procurement', 'Remediation'], 'confidential'],
  ['Staff nominal roll, grade levels and consultancy engagements', 'Legal Unit', ['Personnel'], 'confidential'],
  ['Environmental Impact Assessment reports for the Nsisioken remediation lot', 'Health, Safety & Environment', ['Environmental Assessment'], 'public'],
  ['Health screening data from the Ogoni community health impact study', 'Health, Safety & Environment', ['Public Health'], 'restricted'],
  ['Livelihood empowerment beneficiary lists for the 2025 cohort', 'Livelihood & Empowerment', ['Livelihood Programme', 'Community Relations'], 'internal'],
  ['Payment vouchers for consultancy services rendered between 2024 and 2026', 'Finance & Accounts', ['Budget & Expenditure', 'Audit Query'], 'confidential'],
  ['Copies of the water supply project contracts for Ogale and Eleme', 'Water & Sanitation', ['Water Quality', 'Procurement'], 'internal'],
  ['Correspondence between HYPREP and NOSDRA on spill site certification', 'Legal Unit', ['Remediation', 'Litigation Risk'], 'internal'],
  ['Register of oil spill sites handed over by SPDC to HYPREP', 'Remediation & Restoration', ['Remediation'], 'public'],
  ['Quarterly Monitoring and Evaluation reports for remediation Lots 1 to 4', 'Monitoring & Evaluation', ['Remediation', 'Audit Query'], 'internal'],
  ['Details of the mangrove restoration pilot at Bomu and Yorla', 'Remediation & Restoration', ['Remediation', 'Environmental Assessment'], 'public'],
  ['Community grievance log and resolution status for Khana LGA', 'Community Engagement', ['Community Relations'], 'internal'],
  ['Tender evaluation scoresheets for the 2025 procurement exercise', 'Procurement', ['Procurement'], 'confidential'],
  ['Report of the internal audit of remediation contract variations', 'Finance & Accounts', ['Audit Query', 'Budget & Expenditure'], 'confidential'],
  ['Laboratory accreditation certificates for HYPREP analytical partners', 'Health, Safety & Environment', ['Environmental Assessment'], 'public'],
  ['Schedule of remediation works outstanding as at the last quarter', 'Remediation & Restoration', ['Remediation'], 'public'],
  ['Documents on the Ogoni Trust Fund contribution and disbursement', 'Finance & Accounts', ['Budget & Expenditure'], 'internal'],
  ['List of community liaison officers and their engagement stipends', 'Community Engagement', ['Community Relations', 'Personnel'], 'internal'],
  ['Waste manifest and disposal records for excavated contaminated soil', 'Health, Safety & Environment', ['Remediation', 'Environmental Assessment'], 'internal'],
  ['Feasibility study for the proposed Ogoni Specialist Hospital', 'Health, Safety & Environment', ['Public Health'], 'internal'],
  ['Contract for the supply of potable water tankers to affected communities', 'Water & Sanitation', ['Water Quality', 'Procurement'], 'internal'],
  ['Records of demurrage and idle-time claims by remediation contractors', 'Procurement', ['Contractor Records', 'Litigation Risk'], 'confidential'],
  ['Training records for the Ogoni youth remediation workforce', 'Livelihood & Empowerment', ['Livelihood Programme'], 'public'],
  ['Air quality monitoring data from the Alesa and Aleto stations', 'Health, Safety & Environment', ['Environmental Assessment', 'Public Health'], 'public'],
  ['Full text of the remediation framework agreement with the Federal Ministry', 'Legal Unit', ['Litigation Risk'], 'internal'],
  ['Register of assets and equipment procured for field operations', 'Procurement', ['Procurement', 'Audit Query'], 'internal'],
  ['Site handover certificates for Korokoro and Barako clean-up areas', 'Remediation & Restoration', ['Remediation'], 'public'],
  ['Records of stakeholder consultation meetings with MOSOP', 'Community Engagement', ['Community Relations'], 'public'],
  ['Documents relating to the suspension and reinstatement of Lot 6 works', 'Legal Unit', ['Contractor Records', 'Litigation Risk'], 'confidential'],
  ['Insurance and performance bond documents held for active contracts', 'Procurement', ['Contractor Records'], 'confidential'],
  ['Fish and shellfish contamination survey results for Bodo waterways', 'Health, Safety & Environment', ['Public Health', 'Water Quality'], 'public'],
  ['Breakdown of overhead and administrative expenditure for the last two years', 'Finance & Accounts', ['Budget & Expenditure'], 'internal'],
  ['Approved organogram and departmental staffing establishment', 'Legal Unit', ['Personnel'], 'internal'],
  ['Reports of the Technical Advisory Committee on remediation methodology', 'Remediation & Restoration', ['Remediation', 'Environmental Assessment'], 'internal'],
  ['Copies of all FOI requests received and responses issued in 2025', 'Legal Unit', ['Media Enquiry', 'Audit Query'], 'public'],
  ['Records of legal fees paid to external counsel', 'Legal Unit', ['Litigation Risk', 'Budget & Expenditure'], 'confidential'],
  ['Data on the number of remediated hectares against target', 'Monitoring & Evaluation', ['Remediation'], 'public'],
  ['Documents on the Ejama-Ebubu legacy spill remediation dispute', 'Legal Unit', ['Litigation Risk', 'Remediation'], 'restricted'],
  ['Community development agreements signed with host communities', 'Community Engagement', ['Community Relations', 'Livelihood Programme'], 'public'],
  ['Details of vehicles, fuel allocation and logistics expenditure', 'Finance & Accounts', ['Budget & Expenditure', 'Audit Query'], 'internal'],
  ['Borehole drilling completion reports for the potable water intervention', 'Water & Sanitation', ['Water Quality'], 'public'],
  ['Records of contractor default notices and termination letters', 'Procurement', ['Contractor Records', 'Litigation Risk'], 'confidential'],
  ['Whistle-blower reports received and their investigation outcomes', 'Monitoring & Evaluation', ['Audit Query'], 'restricted'],
  ['Copy of the current HYPREP strategic plan and implementation roadmap', 'Monitoring & Evaluation', ['Remediation'], 'public'],
  ['Land acquisition and compensation payments for remediation staging areas', 'Community Engagement', ['Community Relations', 'Budget & Expenditure'], 'internal'],
  ['Occupational health and safety incident register for field operations', 'Health, Safety & Environment', ['Public Health', 'Personnel'], 'internal'],
  ['Procurement plan and advertisement records for the current financial year', 'Procurement', ['Procurement'], 'public'],
  ['Reports submitted to the Federal Executive Council on remediation progress', 'Monitoring & Evaluation', ['Ministerial Interest', 'Remediation'], 'internal'],
  ['Records of the ICT systems and data management contracts', 'ICT & Data Management', ['Procurement'], 'internal'],
]

/** Qualifiers used to vary repeated topics by site and period, as happens in practice. */
export const SITE_QUALIFIERS = [
  'Bodo', 'K-Dere', 'B-Dere', 'Ogale', 'Nsisioken', 'Ejama-Ebubu', 'Korokoro',
  'Barako', 'Kpean', 'Bomu', 'Yorla', 'Alesa', 'Zaakpon', 'Luawii', 'Norkpo',
]

export const PERIOD_QUALIFIERS = [
  'Q1 2026', 'Q2 2026', 'Q3 2025', 'Q4 2025', 'the 2025 financial year',
  'the 2024 financial year', 'January to June 2026',
]
