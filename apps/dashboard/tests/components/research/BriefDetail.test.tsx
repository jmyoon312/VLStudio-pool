import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import BriefDetail from '@/components/research/BriefDetail';
import type { ProductionResearchBrief } from '@/lib/researchBrain';

function makeBrief(overrides: Partial<ProductionResearchBrief> = {}): ProductionResearchBrief {
    return {
        topic: 'Master blacksmith',
        niche: 'Craft',
        angle: "Why he's the best",
        promise: 'Mastery in 40s',
        atomic_claims: [
            { claim: 'Forge hits 1300C', exact_stat: '1300C', source_url: 'https://a.com', source_title: 'A', credibility: 0.9, verified: true, emotion_trigger: '경이' },
            { claim: 'unverified vague point', source_url: '', source_title: '', credibility: 0.5, verified: false },
        ],
        hook_bank: [
            { type: 'curiosity_gap', text: 'You wont believe step 3', strength: 9 },
            { type: 'question', text: 'Guess his age?', strength: 6 },
        ],
        narrative_beats: {
            shorts: [
                { role: 'hook', text: 'Watch this', seconds: 3 },
                { role: 'point', text: '1300 degrees', seconds: 10 },
                { role: 'payoff', text: 'A blade', seconds: 8 },
            ],
            longform: [
                { index: 1, title: 'Origins', beat: 'his start', rehook: 'but then', seconds: 80, broll_query: 'blacksmith forge' },
            ],
        },
        broll_cues: [{ beat_ref: 'chapter:1', query: 'blacksmith forge', source: 'pexels' }],
        contradictions: [],
        format_card: { hook_type: 'curiosity_gap', story_arc: ['raw', 'process', 'reveal'], source_replacement_query: 'knife making artisan' },
        production_readiness: 9.0,
        gate: { status: 'pass' },
        ...overrides,
    };
}

beforeEach(() => cleanup());

describe('BriefDetail', () => {
    it('renders topic, angle, gate badge and readiness', () => {
        render(<BriefDetail brief={makeBrief()} />);
        expect(screen.getByText('Master blacksmith')).toBeTruthy();
        expect(screen.getByText(/Why he's the best/)).toBeTruthy();
        expect(screen.getByText('제작 확정')).toBeTruthy(); // pass gate
        expect(screen.getByText('제작 준비도')).toBeTruthy();
        expect(screen.getAllByText('9.0').length).toBeGreaterThanOrEqual(1);
    });

    it('renders the hook bank with all hooks', () => {
        render(<BriefDetail brief={makeBrief()} />);
        expect(screen.getByText('You wont believe step 3')).toBeTruthy();
        expect(screen.getByText('Guess his age?')).toBeTruthy();
    });

    it('shows verified claim count and the verified claim text', () => {
        render(<BriefDetail brief={makeBrief()} />);
        expect(screen.getByText('1/2 검증')).toBeTruthy();
        expect(screen.getByText('Forge hits 1300C')).toBeTruthy();
    });

    it('fires onSendToScript with shorts seed when 쇼츠 대본 clicked', () => {
        const onSend = vi.fn();
        render(<BriefDetail brief={makeBrief()} onSendToScript={onSend} />);
        fireEvent.click(screen.getByText('쇼츠 대본'));
        expect(onSend).toHaveBeenCalledTimes(1);
        const [seed, fmt] = onSend.mock.calls[0];
        expect(fmt).toBe('shorts');
        expect(seed).toContain('Watch this');
    });

    it('toggles to longform beats view', () => {
        render(<BriefDetail brief={makeBrief()} />);
        fireEvent.click(screen.getByText(/롱폼 1챕터/));
        expect(screen.getByText('1. Origins')).toBeTruthy();
    });

    it('fires onSearchAsset from format card replacement query', () => {
        const onSearch = vi.fn();
        render(<BriefDetail brief={makeBrief()} onSearchAsset={onSearch} />);
        fireEvent.click(screen.getByText(/knife making artisan/));
        expect(onSearch).toHaveBeenCalledWith('knife making artisan');
    });

    it('shows degraded badge when brief.degraded is true', () => {
        render(<BriefDetail brief={makeBrief({ degraded: true })} />);
        expect(screen.getByText('부분 생성')).toBeTruthy();
    });
});
