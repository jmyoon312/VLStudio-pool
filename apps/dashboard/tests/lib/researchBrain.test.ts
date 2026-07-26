import { describe, it, expect } from 'vitest';
import {
    gateBadge,
    readinessColor,
    readinessPercent,
    bestHook,
    totalShortsSeconds,
    verifiedClaimCount,
    briefToScriptSeed,
    HOOK_TYPE_LABEL,
    type ProductionResearchBrief,
} from '@/lib/researchBrain';

function makeBrief(overrides: Partial<ProductionResearchBrief> = {}): ProductionResearchBrief {
    return {
        topic: 'Master blacksmith',
        niche: 'Craft',
        angle: "Why he's the best",
        promise: 'Mastery in 40s',
        atomic_claims: [
            { claim: 'Forge hits 1300C', exact_stat: '1300C', source_url: 'https://a.com', source_title: 'A', credibility: 0.9, verified: true },
            { claim: '37 years', exact_stat: '37y', source_url: 'https://b.com', source_title: 'B', credibility: 0.9, verified: true },
            { claim: 'vague', source_url: '', source_title: '', credibility: 0.5, verified: false },
        ],
        hook_bank: [
            { type: 'curiosity_gap', text: 'You won\'t believe step 3', strength: 9 },
            { type: 'question', text: 'Guess his age?', strength: 6 },
        ],
        narrative_beats: {
            shorts: [
                { role: 'hook', text: 'Watch', seconds: 3 },
                { role: 'point', text: '1300 degrees', seconds: 10 },
                { role: 'payoff', text: 'A blade', seconds: 8 },
            ],
            longform: [
                { index: 1, title: 'Origins', beat: 'his start', rehook: 'but then', seconds: 80, broll_query: 'forge' },
            ],
        },
        broll_cues: [{ beat_ref: 'chapter:1', query: 'forge', source: 'pexels' }],
        contradictions: [],
        format_card: { hook_type: 'curiosity_gap', story_arc: ['raw', 'process', 'reveal'] },
        production_readiness: 9.0,
        gate: { status: 'pass' },
        ...overrides,
    };
}

describe('gateBadge', () => {
    it('maps statuses to labels/variants', () => {
        expect(gateBadge('pass')).toEqual({ label: '제작 확정', variant: 'success' });
        expect(gateBadge('review').variant).toBe('warning');
        expect(gateBadge('reject').variant).toBe('destructive');
        expect(gateBadge('').variant).toBe('secondary');
    });
});

describe('readiness helpers', () => {
    it('colors by threshold', () => {
        expect(readinessColor(9)).toContain('emerald');
        expect(readinessColor(7)).toContain('amber');
        expect(readinessColor(3)).toContain('red');
    });
    it('converts 0-10 to clamped 0-100 percent', () => {
        expect(readinessPercent(8.5)).toBe(85);
        expect(readinessPercent(99)).toBe(100);
        expect(readinessPercent(-5)).toBe(0);
    });
});

describe('brief derivations', () => {
    it('bestHook picks highest strength', () => {
        expect(bestHook(makeBrief())?.text).toBe("You won't believe step 3");
    });
    it('bestHook null when empty', () => {
        expect(bestHook(makeBrief({ hook_bank: [] }))).toBeNull();
    });
    it('totalShortsSeconds sums beats', () => {
        expect(totalShortsSeconds(makeBrief())).toBe(21);
    });
    it('verifiedClaimCount counts verified only', () => {
        expect(verifiedClaimCount(makeBrief())).toBe(2);
    });
});

describe('briefToScriptSeed', () => {
    it('shorts seed includes hook label, beats and verified facts only', () => {
        const seed = briefToScriptSeed(makeBrief(), 'shorts');
        expect(seed).toContain(HOOK_TYPE_LABEL['curiosity_gap']);
        expect(seed).toContain('[후킹 3s] Watch');
        expect(seed).toContain('Forge hits 1300C [1300C] (https://a.com)');
        expect(seed).not.toContain('vague'); // unverified excluded
    });
    it('longform seed includes chapters and rehook', () => {
        const seed = briefToScriptSeed(makeBrief(), 'longform');
        expect(seed).toContain('### 1. Origins (80s)');
        expect(seed).toContain('re-hook: but then');
    });
});
