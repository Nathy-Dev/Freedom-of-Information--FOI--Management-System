import type { LetterTemplate } from '@/types'
import { relativeIso } from './reference'

/** Merge fields available to every template, surfaced in the editor sidebar. */
export const MERGE_FIELDS = [
  '{{case_number}}',
  '{{requestor_name}}',
  '{{requestor_organization}}',
  '{{requestor_email}}',
  '{{requestor_address}}',
  '{{subject}}',
  '{{date_submitted}}',
  '{{statutory_due_date}}',
  '{{today}}',
  '{{officer_name}}',
  '{{officer_position}}',
  '{{department}}',
  '{{exemption_grounds}}',
  '{{records_released}}',
  '{{records_withheld}}',
  '{{fee_amount}}',
  '{{suit_number}}',
  '{{court_name}}',
  '{{hearing_date}}',
]

const LETTERHEAD = `FEDERAL REPUBLIC OF NIGERIA
FEDERAL MINISTRY OF ENVIRONMENT
HYDROCARBON POLLUTION REMEDIATION PROJECT (HYPREP)
Legal Unit · Port Harcourt, Rivers State

Our Ref: {{case_number}}
Date: {{today}}`

export const letterTemplates: LetterTemplate[] = [
  {
    id: 'tpl-001',
    name: 'Acknowledgement of FOI Request',
    category: 'acknowledgement',
    description:
      'Issued within 48 hours of receipt. Confirms the case number and the seven-day statutory response date under section 4 of the Act.',
    mergeFields: ['{{case_number}}', '{{requestor_name}}', '{{subject}}', '{{date_submitted}}', '{{statutory_due_date}}', '{{officer_name}}'],
    updatedBy: 'usr-004',
    updatedAt: relativeIso(-42, 10, 15),
    usageCount: 412,
    body: `${LETTERHEAD}

{{requestor_name}}
{{requestor_organization}}
{{requestor_email}}

Dear Sir/Madam,

ACKNOWLEDGEMENT OF YOUR REQUEST FOR INFORMATION — {{subject}}

We acknowledge receipt of your request for information dated {{date_submitted}}, received by the Hydrocarbon Pollution Remediation Project (HYPREP) and registered as {{case_number}}.

Your request is being processed in accordance with the Freedom of Information Act 2011. In line with section 4 of the Act, a determination will be communicated to you on or before {{statutory_due_date}}.

Where the volume of records or the need to consult a third party makes it impracticable to respond within that period, we shall notify you of an extension of not more than seven further days, stating the reason, as permitted by section 6 of the Act.

Kindly quote the reference {{case_number}} in all correspondence on this matter.

Yours faithfully,

{{officer_name}}
{{officer_position}}
For: Project Coordinator, HYPREP`,
  },
  {
    id: 'tpl-002',
    name: 'Full Disclosure Response',
    category: 'response',
    description: 'Grants access in full and transmits the records with the response letter.',
    mergeFields: ['{{case_number}}', '{{requestor_name}}', '{{subject}}', '{{records_released}}', '{{officer_name}}'],
    updatedBy: 'usr-004',
    updatedAt: relativeIso(-30, 14, 40),
    usageCount: 268,
    body: `${LETTERHEAD}

{{requestor_name}}
{{requestor_organization}}

Dear Sir/Madam,

DETERMINATION ON YOUR REQUEST FOR INFORMATION — {{case_number}}

Further to your request dated {{date_submitted}} concerning {{subject}}, we write to inform you that HYPREP has granted your request in full.

The following records are released to you herewith:

{{records_released}}

The records are provided in the format you elected. No fee is assessed for reproduction in this instance.

If you are dissatisfied with any aspect of the manner in which this request was handled, you may apply to the Federal High Court for a review of the decision under section 20 of the Freedom of Information Act 2011 within thirty days.

Yours faithfully,

{{officer_name}}
{{officer_position}}
For: Project Coordinator, HYPREP`,
  },
  {
    id: 'tpl-003',
    name: 'Partial Disclosure Response (Severance)',
    category: 'response',
    description:
      'Grants access in part. Lists the released records and the grounds relied upon for each severance, as required by section 18.',
    mergeFields: ['{{case_number}}', '{{requestor_name}}', '{{records_released}}', '{{records_withheld}}', '{{exemption_grounds}}', '{{officer_name}}'],
    updatedBy: 'usr-005',
    updatedAt: relativeIso(-18, 9, 5),
    usageCount: 331,
    body: `${LETTERHEAD}

{{requestor_name}}
{{requestor_organization}}

Dear Sir/Madam,

DETERMINATION ON YOUR REQUEST FOR INFORMATION — {{case_number}}

We refer to your request dated {{date_submitted}} concerning {{subject}}.

HYPREP has granted your request in part. The following records are released to you:

{{records_released}}

The following information has been severed from the records released:

{{records_withheld}}

The severances are made on the following grounds:

{{exemption_grounds}}

In accordance with section 18 of the Freedom of Information Act 2011, where exempt information can reasonably be severed from a record, the remainder of the record has been released to you.

You may apply to the Federal High Court for a review of this decision under section 20 of the Act within thirty days of the date of this letter.

Yours faithfully,

{{officer_name}}
{{officer_position}}
For: Project Coordinator, HYPREP`,
  },
  {
    id: 'tpl-004',
    name: 'Refusal Notice (Exemption Applied)',
    category: 'refusal',
    description:
      'Refuses access and states the specific exemption relied upon together with the right of judicial review.',
    mergeFields: ['{{case_number}}', '{{requestor_name}}', '{{subject}}', '{{exemption_grounds}}', '{{officer_name}}'],
    updatedBy: 'usr-004',
    updatedAt: relativeIso(-25, 11, 30),
    usageCount: 96,
    body: `${LETTERHEAD}

{{requestor_name}}
{{requestor_organization}}

Dear Sir/Madam,

NOTICE OF REFUSAL — {{case_number}}

We refer to your request dated {{date_submitted}} for access to records concerning {{subject}}.

After careful consideration, HYPREP has determined that your request cannot be granted. The information sought is exempt from disclosure on the following grounds:

{{exemption_grounds}}

In arriving at this determination we considered whether the public interest in disclosure outweighs the protected interest, and concluded that it does not in the present circumstances.

Pursuant to section 4(b) of the Freedom of Information Act 2011, you are hereby notified of your right to challenge this determination. You may apply to the Federal High Court for a judicial review of this decision under section 20 of the Act within thirty days of the date of this letter.

Yours faithfully,

{{officer_name}}
{{officer_position}}
For: Project Coordinator, HYPREP`,
  },
  {
    id: 'tpl-005',
    name: 'Section 6 Extension Notice',
    category: 'notice',
    description: 'Notifies the requestor of a seven-day extension and states the reason relied upon.',
    mergeFields: ['{{case_number}}', '{{requestor_name}}', '{{statutory_due_date}}', '{{officer_name}}'],
    updatedBy: 'usr-006',
    updatedAt: relativeIso(-12, 15, 20),
    usageCount: 143,
    body: `${LETTERHEAD}

{{requestor_name}}
{{requestor_organization}}

Dear Sir/Madam,

NOTICE OF EXTENSION OF TIME — {{case_number}}

We refer to your request dated {{date_submitted}} concerning {{subject}}.

HYPREP requires additional time to respond to your request. Accordingly, and in exercise of the power conferred by section 6 of the Freedom of Information Act 2011, the time for responding is extended by seven days to {{statutory_due_date}}.

The extension is necessary because the request relates to a large volume of records which cannot be located, collated and reviewed within the original period without unreasonably interfering with the operations of the institution, and because consultation with an affected third party is required.

We regret any inconvenience and assure you that your request is receiving attention.

Yours faithfully,

{{officer_name}}
{{officer_position}}
For: Project Coordinator, HYPREP`,
  },
  {
    id: 'tpl-006',
    name: 'Request for Clarification',
    category: 'notice',
    description: 'Seeks clarification where a request is too broad to identify the records sought.',
    mergeFields: ['{{case_number}}', '{{requestor_name}}', '{{subject}}', '{{officer_name}}'],
    updatedBy: 'usr-007',
    updatedAt: relativeIso(-8, 12, 10),
    usageCount: 87,
    body: `${LETTERHEAD}

{{requestor_name}}
{{requestor_organization}}

Dear Sir/Madam,

REQUEST FOR CLARIFICATION — {{case_number}}

We refer to your request dated {{date_submitted}} concerning {{subject}}.

To enable us to identify and retrieve the records you seek, we should be grateful for clarification of the following:

1. The period to which your request relates;
2. The specific sites, contracts or projects of interest;
3. The categories of document you require (for example, contracts, payment schedules, laboratory results or correspondence).

Kindly note that the statutory period for responding will run from the date we receive your clarification. We remain available to assist you in reframing the request should that be helpful.

Yours faithfully,

{{officer_name}}
{{officer_position}}
For: Project Coordinator, HYPREP`,
  },
  {
    id: 'tpl-007',
    name: 'Notice of Transfer to Another Institution',
    category: 'notice',
    description: 'Transfers a request, in whole or in part, to the public institution that holds the records.',
    mergeFields: ['{{case_number}}', '{{requestor_name}}', '{{subject}}', '{{officer_name}}'],
    updatedBy: 'usr-005',
    updatedAt: relativeIso(-55, 10, 45),
    usageCount: 34,
    body: `${LETTERHEAD}

{{requestor_name}}
{{requestor_organization}}

Dear Sir/Madam,

NOTICE OF TRANSFER OF REQUEST — {{case_number}}

We refer to your request dated {{date_submitted}} concerning {{subject}}.

The records you seek, or a part of them, are not held by HYPREP but by another public institution to whose functions they are more closely related. Accordingly, and pursuant to section 5 of the Freedom of Information Act 2011, your request has been transferred to that institution, which will respond to you directly.

Any portion of your request relating to records held by HYPREP continues to be processed under the reference above, and a separate determination will issue on that portion.

Yours faithfully,

{{officer_name}}
{{officer_position}}
For: Project Coordinator, HYPREP`,
  },
  {
    id: 'tpl-008',
    name: 'Counter-Affidavit in Opposition',
    category: 'affidavit',
    description: 'Skeleton counter-affidavit for judicial review proceedings under section 20 of the Act.',
    mergeFields: ['{{suit_number}}', '{{court_name}}', '{{case_number}}', '{{requestor_name}}', '{{officer_name}}', '{{officer_position}}'],
    updatedBy: 'usr-008',
    updatedAt: relativeIso(-20, 16, 0),
    usageCount: 21,
    body: `IN THE FEDERAL HIGH COURT OF NIGERIA
IN THE {{court_name}}

SUIT NO: {{suit_number}}

BETWEEN:

{{requestor_name}} ......................................... APPLICANT

AND

HYDROCARBON POLLUTION REMEDIATION PROJECT (HYPREP) ...... RESPONDENT

COUNTER-AFFIDAVIT

I, {{officer_name}}, Nigerian citizen, {{officer_position}} of the Hydrocarbon Pollution Remediation Project, of Port Harcourt, Rivers State, do hereby make oath and state as follows:

1. That I am the {{officer_position}} of the Respondent and by virtue of my position I am conversant with the facts of this case.

2. That I have read the affidavit in support of the Applicant's originating summons and respond as follows.

3. That the Applicant's request, registered by the Respondent as {{case_number}}, was received and acknowledged within the time prescribed by the Freedom of Information Act 2011.

4. That a diligent search was conducted for the records described in the request and the outcome of that search was communicated to the Applicant in writing.

5. That the information withheld from the Applicant is exempt from disclosure under the Freedom of Information Act 2011, and the Respondent severed and released all portions capable of severance.

6. That the Respondent at all material times acted in compliance with its statutory obligations.

7. That I depose to this affidavit in good faith, believing same to be true and in accordance with the Oaths Act.

................................
DEPONENT

SWORN to at the Federal High Court Registry, Port Harcourt
This ......... day of ....................... 20.......

BEFORE ME

................................
COMMISSIONER FOR OATHS`,
  },
  {
    id: 'tpl-009',
    name: 'Internal Exemption Analysis Memorandum',
    category: 'internal',
    description: 'Internal legal opinion recording the exemption analysis and the recommendation to the Coordinator.',
    mergeFields: ['{{case_number}}', '{{subject}}', '{{department}}', '{{officer_name}}', '{{exemption_grounds}}'],
    updatedBy: 'usr-004',
    updatedAt: relativeIso(-6, 13, 25),
    usageCount: 189,
    body: `INTERNAL MEMORANDUM — LEGAL UNIT
CONFIDENTIAL / LEGALLY PRIVILEGED

TO:      Project Coordinator, HYPREP
FROM:    {{officer_name}}, Legal Unit
DATE:    {{today}}
REF:     {{case_number}}

SUBJECT: EXEMPTION ANALYSIS AND RECOMMENDATION — {{subject}}

1. BACKGROUND
   The above request was received on {{date_submitted}} and routed to {{department}} for a record search. The statutory determination date is {{statutory_due_date}}.

2. RECORDS LOCATED
   The search returned the records listed in the attached schedule. Volume and format are noted against each item.

3. EXEMPTION ANALYSIS
{{exemption_grounds}}

4. PUBLIC INTEREST CONSIDERATION
   The public interest in transparency over remediation expenditure is weighed against the protected interests identified above. Where the balance favours disclosure, severance rather than refusal is recommended.

5. RECOMMENDATION
   That the request be granted in part, with the severances set out in the attached redaction schedule, and that the determination letter at Annexure A be approved for signature.

{{officer_name}}
Legal Unit`,
  },
  {
    id: 'tpl-010',
    name: 'Hearing Notification to Counsel',
    category: 'internal',
    description: 'Internal notice circulated to counsel and the case officer ahead of a listed hearing.',
    mergeFields: ['{{suit_number}}', '{{court_name}}', '{{hearing_date}}', '{{case_number}}', '{{officer_name}}'],
    updatedBy: 'usr-008',
    updatedAt: relativeIso(-3, 9, 40),
    usageCount: 64,
    body: `INTERNAL NOTICE — LITIGATION DIARY

REF:   {{case_number}}
SUIT:  {{suit_number}}
COURT: {{court_name}}
DATE:  {{hearing_date}}

Counsel and the case officer are notified that the above matter has been listed as set out.

ACTION REQUIRED BEFORE THE DATE
1. Confirm the case file is complete: originating process, counter-affidavit, written address and exhibit bundle.
2. Ensure certified true copies of the determination letter and the acknowledgement are available.
3. Confirm the attendance of the FOI Desk Officer where personal appearance has been directed.
4. Notify the Head of Legal Unit of any application to be moved on the date.

Reminders will issue seven days, two days and one day before the hearing.

{{officer_name}}
Litigation Desk, Legal Unit`,
  },
]
