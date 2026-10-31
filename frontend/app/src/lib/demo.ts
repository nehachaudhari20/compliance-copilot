import type { AIResult, AuditEntry, Comparison, LibraryDocument, Role } from './api';

export const DEMO_PREFIX = 'demo-';

export function isDemoId(id: string) {
  return id.startsWith(DEMO_PREFIX);
}

export function realDocIds(ids: string[]) {
  return ids.filter((id) => !isDemoId(id));
}

export function hasUploadedDocuments(documents: LibraryDocument[]) {
  return documents.some((doc) => !isDemoId(doc.id));
}

/** Backend index hints often use a Unix venv path; show a portable command in the UI. */
export function formatIndexMessage(message: string | null | undefined) {
  if (!message) return message ?? null;
  return message
    .replace(/\.venv[/\\]bin[/\\]python/g, 'python')
    .replace(/\.venv[/\\]Scripts[/\\]python\.exe/g, 'python');
}

function field<T extends string | null>(value: T) {
  return { value, status: 'user_supplied' as const };
}

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();

export const DEMO_FAMILY_LODR = 'demo-fam-lodr';
export const DEMO_FAMILY_KYC = 'demo-fam-kyc';

export const DEMO_DOCUMENTS: LibraryDocument[] = [
  {
    id: 'demo-lodr-2025',
    family_id: DEMO_FAMILY_LODR,
    organization: null,
    kind: 'regulatory',
    visibility: 'shared',
    content_hash: 'demo-lodr-2025',
    uploaded_at: daysAgo(12),
    page_count: 248,
    indexed: true,
    metadata: {
      title: field('SEBI LODR Master Circular (sample)'),
      regulator: field('SEBI'),
      document_type: field('Master circular'),
      source_url: field('https://www.sebi.gov.in/legal/master-circulars'),
      publication_date: field('2025-01-10'),
      version: field('Jan 2025'),
      effective_date: field('2025-01-15'),
    },
  },
  {
    id: 'demo-lodr-2024',
    family_id: DEMO_FAMILY_LODR,
    organization: null,
    kind: 'regulatory',
    visibility: 'shared',
    content_hash: 'demo-lodr-2024',
    uploaded_at: daysAgo(400),
    page_count: 241,
    indexed: true,
    metadata: {
      title: field('SEBI LODR Master Circular (sample)'),
      regulator: field('SEBI'),
      document_type: field('Master circular'),
      source_url: field('https://www.sebi.gov.in/legal/master-circulars'),
      publication_date: field('2024-01-08'),
      version: field('Jan 2024'),
      effective_date: field('2024-01-12'),
    },
  },
  {
    id: 'demo-kyc-policy',
    family_id: DEMO_FAMILY_KYC,
    organization: 'demo-org',
    kind: 'internal',
    visibility: 'organization',
    content_hash: 'demo-kyc-policy',
    uploaded_at: daysAgo(45),
    page_count: 18,
    indexed: true,
    metadata: {
      title: field('Customer KYC & AML Policy (sample)'),
      regulator: field(null),
      document_type: field('Internal policy'),
      source_url: field(null),
      publication_date: field('2024-06-01'),
      version: field('v3.2'),
      effective_date: field('2024-07-01'),
    },
  },
  {
    id: 'demo-rbi-cyber',
    family_id: 'demo-fam-rbi-cyber',
    organization: null,
    kind: 'regulatory',
    visibility: 'shared',
    content_hash: 'demo-rbi-cyber',
    uploaded_at: daysAgo(90),
    page_count: 52,
    indexed: true,
    metadata: {
      title: field('RBI Master Direction – IT Framework for NBFCs (sample)'),
      regulator: field('RBI'),
      document_type: field('Master direction'),
      source_url: field('https://www.rbi.org.in/'),
      publication_date: field('2024-11-01'),
      version: field('Nov 2024'),
      effective_date: field('2024-12-01'),
    },
  },
];

const demoCitation = (documentId: string, page: number, quote: string, keyPhrase?: string) => ({
  document_id: documentId,
  chunk_id: `${documentId}-p${page}`,
  page,
  quote,
  section: page === 236 ? 'Annexure 18A' : undefined,
  source_url: field('https://www.sebi.gov.in/'),
  key_phrase: keyPhrase,
});

export const DEMO_QA_RESULT: AIResult = {
  task: 'qa',
  model: 'sample-preview',
  generation_seconds: 4.2,
  evidence_excerpts: 3,
  limitations: 'Sample answer for layout preview only. Upload and index your own documents to run live checks.',
  items: [
    {
      statement: 'Listed entities must disclose material events to stock exchanges promptly.',
      interpretation: 'Disclosure timelines depend on where the event arose and whether the board has met.',
      citations: [demoCitation('demo-lodr-2025', 236, 'The listed entity shall disclose to the stock exchange(s) all events or information… within thirty minutes from the closure of the meeting…', 'thirty minutes')],
      assessment: null,
      review_status: 'pending',
    },
  ],
  rejected_items: [],
  notes: [],
  focus: {
    answer: 'Within 30 minutes of a board decision, 12 hours if the event arises inside the company, 24 hours if it arises outside.',
    highlights: ['30 minutes', '12 hours', '24 hours'],
    labels: { '30 minutes': 'Board decision', '12 hours': 'Inside company', '24 hours': 'Outside company' },
    note: 'Sample summary built from verified statements.',
  },
  focus_seconds: 1.1,
};

export const DEMO_GAP_RESULT: AIResult = {
  task: 'gap_analysis',
  model: 'sample-preview',
  generation_seconds: 9.8,
  evidence_excerpts: 8,
  limitations: 'Sample gap check for preview. Run a new check after you upload policies.',
  items: [
    {
      statement: 'Material event disclosure timelines are defined.',
      interpretation: 'The policy mentions disclosure but not the exchange timelines in LODR Annexure 18A.',
      citations: [
        demoCitation('demo-lodr-2025', 236, '…within thirty minutes from the closure of the meeting…', 'thirty minutes'),
        demoCitation('demo-kyc-policy', 4, 'Material developments shall be reported to compliance within one business day.', 'one business day'),
      ],
      assessment: 'POTENTIAL_GAP',
      review_status: 'pending',
      status_label: 'Potential gap',
      risk: 'high',
    },
    {
      statement: 'Customer identification is required before onboarding.',
      interpretation: 'Policy requires ID verification before account activation, consistent with KYC norms.',
      citations: [demoCitation('demo-kyc-policy', 2, 'No account shall be opened until identity and address are verified.', 'identity and address')],
      assessment: 'APPEARS_ADDRESSED',
      review_status: 'pending',
      status_label: 'Addressed',
      risk: 'low',
    },
  ],
  rejected_items: [],
  notes: [],
  gap_summary: {
    score: 62,
    assessed_items: 2,
    not_assessed_items: 0,
    high_risk_items: 1,
    counts: { APPEARS_ADDRESSED: 1, POTENTIAL_GAP: 1 },
    method: 'Deterministic score from model labels (sample).',
  },
};

export const DEMO_COMPARISON: Comparison = {
  older: DEMO_DOCUMENTS[1],
  newer: DEMO_DOCUMENTS[0],
  reordered: false,
  total_changes: 3,
  counts: { added: 1, removed: 0, modified: 2 },
  changes: [
    {
      change: 'modified',
      old_pages: [236, 236],
      new_pages: [236, 236],
      removed: ['…within sixty minutes from the closure of the meeting…'],
      added: ['…within thirty minutes from the closure of the meeting…'],
      truncated: false,
    },
    {
      change: 'added',
      old_pages: [0, 0],
      new_pages: [12, 12],
      removed: [],
      added: ['Listed entities shall verify market rumours through a designated officer within two trading days.'],
      truncated: false,
    },
    {
      change: 'modified',
      old_pages: [88, 88],
      new_pages: [90, 90],
      removed: ['Related party transactions require audit committee approval above five crore rupees.'],
      added: ['Related party transactions require audit committee approval above ten crore rupees.'],
      truncated: false,
    },
  ],
};

export const DEMO_AUDIT_ENTRIES: (AuditEntry & { result?: AIResult | null })[] = [
  {
    id: 'demo-audit-qa-1',
    created_at: daysAgo(2),
    finished_at: daysAgo(2),
    user_name: 'Asha Rao',
    user_role: 'compliance_officer' as Role,
    role_label: 'Compliance Officer',
    task: 'qa',
    question: 'How quickly must a listed company disclose a material event?',
    document_ids: ['demo-lodr-2025'],
    status: 'completed',
    model: 'sample-preview',
    generation_seconds: 5.3,
    accepted: 1,
    rejected: 0,
    error: null,
    result: DEMO_QA_RESULT,
  },
  {
    id: 'demo-audit-gap-1',
    created_at: daysAgo(5),
    finished_at: daysAgo(5),
    user_name: 'Rahul Mehta',
    user_role: 'risk' as Role,
    role_label: 'Risk',
    task: 'gap_analysis',
    question: 'Assess whether the internal KYC policy meets LODR disclosure requirements.',
    document_ids: ['demo-lodr-2025', 'demo-kyc-policy'],
    status: 'completed',
    model: 'sample-preview',
    generation_seconds: 11.2,
    accepted: 2,
    rejected: 0,
    error: null,
    result: DEMO_GAP_RESULT,
  },
  {
    id: 'demo-audit-checklist-1',
    created_at: daysAgo(8),
    finished_at: daysAgo(8),
    user_name: 'Priya Nair',
    user_role: 'legal' as Role,
    role_label: 'Legal',
    task: 'checklist',
    question: 'Board meeting disclosure obligations for listed entities',
    document_ids: ['demo-lodr-2025'],
    status: 'completed',
    model: 'sample-preview',
    generation_seconds: 6.1,
    accepted: 4,
    rejected: 1,
    error: null,
    result: {
      ...DEMO_QA_RESULT,
      task: 'checklist',
      items: [
        { ...DEMO_QA_RESULT.items[0], statement: 'Confirm 30-minute post-board disclosure process is documented.' },
        { ...DEMO_QA_RESULT.items[0], statement: 'Maintain log of material events with timestamps and approver.' },
      ],
    },
  },
  {
    id: 'demo-audit-qa-2',
    created_at: daysAgo(14),
    finished_at: daysAgo(14),
    user_name: 'Asha Rao',
    user_role: 'compliance_officer' as Role,
    role_label: 'Compliance Officer',
    task: 'qa',
    question: 'Who must verify market rumours under LODR?',
    document_ids: ['demo-lodr-2025'],
    status: 'completed',
    model: 'sample-preview',
    generation_seconds: 4.8,
    accepted: 1,
    rejected: 0,
    error: null,
    result: DEMO_QA_RESULT,
  },
];

export function isDemoAuditId(id: string) {
  return id.startsWith('demo-audit-');
}

export function getDemoAuditEntry(id: string): AuditEntry | null {
  const row = DEMO_AUDIT_ENTRIES.find((e) => e.id === id);
  if (!row) return null;
  const { result, ...entry } = row;
  return { ...entry, result: result ?? null };
}

export function mergeDocuments(documents: LibraryDocument[]) {
  const seen = new Set(documents.map((d) => d.id));
  return [...documents, ...DEMO_DOCUMENTS.filter((d) => !seen.has(d.id))];
}

export function mergeAuditEntries(entries: AuditEntry[]) {
  const seen = new Set(entries.map((e) => e.id));
  const demoRows = DEMO_AUDIT_ENTRIES.filter((e) => !seen.has(e.id)).map(({ result: _result, ...entry }) => entry);
  return [...entries, ...demoRows].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function demoComparison(olderId: string, newerId: string): Comparison | null {
  if (!isDemoId(olderId) || !isDemoId(newerId)) return null;
  if (olderId === 'demo-lodr-2024' && newerId === 'demo-lodr-2025') return DEMO_COMPARISON;
  const older = DEMO_DOCUMENTS.find((d) => d.id === olderId);
  const newer = DEMO_DOCUMENTS.find((d) => d.id === newerId);
  if (!older || !newer || older.family_id !== newer.family_id) return null;
  return { ...DEMO_COMPARISON, older, newer, total_changes: 0, counts: { added: 0, removed: 0, modified: 0 }, changes: [] };
}
