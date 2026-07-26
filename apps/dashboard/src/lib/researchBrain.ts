// Research Brain — shared types and pure helpers for the AI Research Intelligence UI.
// Pure functions here are unit-tested in tests/lib/researchBrain.test.ts

export type HookType =
    | 'curiosity_gap'
    | 'bold_claim'
    | 'question'
    | 'micro_story'
    | 'visual_shock';

export type BeatRole = 'hook' | 'point' | 'payoff' | 'loop';
export type GateStatus = 'pass' | 'review' | 'reject' | '';

export interface AtomicClaim {
    claim: string;
    exact_stat?: string | null;
    source_url: string;
    source_title: string;
    credibility: number;
    verified: boolean;
    emotion_trigger?: string | null;
}

export interface Hook {
    type: HookType;
    text: string;
    strength: number;
    claim_ref?: number | null;
}

export interface ShortBeat {
    role: BeatRole;
    text: string;
    seconds: number;
    claim_ref?: number | null;
}

export interface Chapter {
    index: number;
    title: string;
    beat: string;
    rehook?: string | null;
    seconds: number;
    broll_query?: string | null;
}

export interface BrollCue {
    beat_ref: string;
    query: string;
    source: string;
    asset_id?: string | null;
}

export interface FormatCard {
    hook_type?: HookType | null;
    story_arc: string[];
    source_replacement_query?: string | null;
}

export interface ProductionResearchBrief {
    topic: string;
    niche: string;
    angle: string;
    promise: string;
    atomic_claims: AtomicClaim[];
    hook_bank: Hook[];
    narrative_beats: { shorts: ShortBeat[]; longform: Chapter[] };
    broll_cues: BrollCue[];
    contradictions: { claim_a: string; claim_b: string; note: string }[];
    format_card: FormatCard;
    production_readiness: number;
    gate?: { status: GateStatus } | null;
    degraded?: boolean;
}

// ── Pure presentation helpers ──

export const HOOK_TYPE_LABEL: Record<HookType, string> = {
    curiosity_gap: '호기심 갭',
    bold_claim: '대담한 주장',
    question: '질문형',
    micro_story: '미니 스토리',
    visual_shock: '시각 충격',
};

export const BEAT_ROLE_LABEL: Record<BeatRole, string> = {
    hook: '후킹',
    point: '포인트',
    payoff: '페이오프',
    loop: '루프',
};

export function gateBadge(status: GateStatus): { label: string; variant: string } {
    switch (status) {
        case 'pass':
            return { label: '제작 확정', variant: 'success' };
        case 'review':
            return { label: '검토 필요', variant: 'warning' };
        case 'reject':
            return { label: '기준 미달', variant: 'destructive' };
        default:
            return { label: '미평가', variant: 'secondary' };
    }
}

// 0-10 readiness -> tailwind text color
export function readinessColor(readiness: number): string {
    if (readiness >= 8.5) return 'text-emerald-600';
    if (readiness >= 6.5) return 'text-amber-600';
    return 'text-red-600';
}

// 0-10 -> 0-100 for <Progress />
export function readinessPercent(readiness: number): number {
    return Math.max(0, Math.min(100, Math.round(readiness * 10)));
}

export function bestHook(brief: ProductionResearchBrief): Hook | null {
    if (!brief.hook_bank || brief.hook_bank.length === 0) return null;
    return brief.hook_bank.reduce((a, b) => (b.strength > a.strength ? b : a));
}

export function totalShortsSeconds(brief: ProductionResearchBrief): number {
    return (brief.narrative_beats?.shorts || []).reduce((sum, b) => sum + (b.seconds || 0), 0);
}

export function verifiedClaimCount(brief: ProductionResearchBrief): number {
    return (brief.atomic_claims || []).filter((c) => c.verified).length;
}

// Build a copy-paste script seed for the script writer, from the chosen format.
export function briefToScriptSeed(
    brief: ProductionResearchBrief,
    format: 'shorts' | 'longform',
): string {
    const lines: string[] = [];
    lines.push(`# ${brief.topic}`);
    if (brief.angle) lines.push(`Angle: ${brief.angle}`);
    if (brief.promise) lines.push(`Promise: ${brief.promise}`);
    lines.push('');

    const hook = bestHook(brief);
    if (hook) lines.push(`HOOK (${HOOK_TYPE_LABEL[hook.type]}): ${hook.text}`);
    lines.push('');

    if (format === 'shorts') {
        lines.push('## Shorts beats');
        (brief.narrative_beats?.shorts || []).forEach((b) => {
            lines.push(`- [${BEAT_ROLE_LABEL[b.role]} ${b.seconds}s] ${b.text}`);
        });
    } else {
        lines.push('## Longform chapters');
        (brief.narrative_beats?.longform || []).forEach((ch) => {
            lines.push(`### ${ch.index}. ${ch.title} (${ch.seconds}s)`);
            lines.push(ch.beat);
            if (ch.rehook) lines.push(`(re-hook: ${ch.rehook})`);
        });
    }

    lines.push('');
    lines.push('## Verified facts');
    (brief.atomic_claims || [])
        .filter((c) => c.verified)
        .forEach((c) => {
            const stat = c.exact_stat ? ` [${c.exact_stat}]` : '';
            const src = c.source_url ? ` (${c.source_url})` : '';
            lines.push(`- ${c.claim}${stat}${src}`);
        });

    return lines.join('\n');
}
