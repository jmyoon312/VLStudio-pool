import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import PresetSelector from './PresetSelector';

export interface SubtitleConfig {
    enabled: boolean;
    // Style
    font: string;
    fontSize: number;
    isBold: boolean;
    isItalic: boolean;
    textColor: string;
    outlineSize: number;
    outlineColor: string;
    shadowSize: number;
    shadowColor: string;
    // Box & Pos
    useBox: boolean;
    boxColor: string;
    boxOpacity: number;
    position: 'top' | 'middle' | 'bottom' | 'custom';
    marginV: number;
    customX: number;
    customY: number;
    // Anim & Split
    animation?: string; // Deprecated
    animationEntrance?: string;
    animationExit?: string;
    animationEmphasis?: string;
    splitLimit: number;
}

interface SubtitleSettingsPanelProps {
    config: SubtitleConfig;
    onChange: (config: SubtitleConfig) => void;
}

const SubtitleSettingsPanel: React.FC<SubtitleSettingsPanelProps> = ({ config, onChange }) => {
    const [availableFonts, setAvailableFonts] = useState<Record<string, string[]>>({});

    useEffect(() => {
        // Fetch fonts
        fetch('/tools/fonts')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setAvailableFonts({ "Other": data });
                } else {
                    setAvailableFonts(data);
                }
            })
            .catch(err => console.error("Failed to fetch fonts:", err));
    }, []);

    const handlePresetSelect = (newConfig: any) => {
        onChange({
            ...newConfig,
            animationEntrance: newConfig.animationEntrance || newConfig.animation || 'none',
            animationExit: newConfig.animationExit || 'none',
            animationEmphasis: newConfig.animationEmphasis || 'none'
        });
    };

    const isFontAvailable = (fontName: string) => {
        return Object.values(availableFonts).flat().includes(fontName);
    };

    return (
        <div className="space-y-4">
            <PresetSelector
                type="subtitle"
                currentConfig={config}
                onSelect={handlePresetSelect}
            />

            <div className="py-2">
                <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg bg-muted/20 mb-4">
                    <div className="space-y-1">
                        <Label className="text-sm font-medium flex items-center gap-2">
                            📝 자막 표시 (Enable Subtitles)
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                            켜면 대본 내용을 영상에 자막으로 입힙니다.
                        </p>
                    </div>
                    <Switch
                        checked={config.enabled}
                        onCheckedChange={(checked) => onChange({ ...config, enabled: checked })}
                    />
                </div>

                <Tabs defaultValue="style" className={`w-full ${!config.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="style">스타일 (Style)</TabsTrigger>
                        <TabsTrigger value="position">배경 & 위치</TabsTrigger>
                        <TabsTrigger value="animation">애니메이션</TabsTrigger>
                    </TabsList>

                    <TabsContent value="style" className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>폰트 (Font)</Label>
                                <div className="space-y-2">
                                    <Select
                                        value={isFontAvailable(config.font) ? config.font : "custom"}
                                        onValueChange={(val) => {
                                            if (val === "custom") {
                                                if (isFontAvailable(config.font)) {
                                                    onChange({ ...config, font: "" });
                                                }
                                            } else {
                                                onChange({ ...config, font: val });
                                            }
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="폰트 선택" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[300px]">
                                            {Object.entries(availableFonts).map(([lang, fonts]) => (
                                                fonts.length > 0 && (
                                                    <React.Fragment key={lang}>
                                                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                                                            {lang === "Korean" ? "한국어 (Korean)" :
                                                                lang === "English" ? "영어 (English)" :
                                                                    lang === "Japanese" ? "일본어 (Japanese)" :
                                                                        lang === "Chinese" ? "중국어 (Chinese)" :
                                                                            "기타 (Other)"}
                                                        </div>
                                                        {fonts.map((font) => (
                                                            <SelectItem key={font} value={font}>{font}</SelectItem>
                                                        ))}
                                                    </React.Fragment>
                                                )
                                            ))}
                                            <div className="my-1 h-px bg-muted" />
                                            <SelectItem value="custom">직접 입력 (Custom...)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {(!isFontAvailable(config.font) || config.font === "") && (
                                        <div className="space-y-1">
                                            <Input
                                                placeholder="폰트 이름 입력 (예: Malgun Gothic)"
                                                value={config.font}
                                                onChange={(e) => onChange({ ...config, font: e.target.value })}
                                            />
                                            <p className="text-[10px] text-muted-foreground">
                                                * 시스템에 설치된 폰트 이름을 정확히 입력해야 합니다.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>크기 (Size): {config.fontSize}</Label>
                                <Slider
                                    value={[config.fontSize]}
                                    min={10} max={100} step={1}
                                    onValueChange={([val]) => onChange({ ...config, fontSize: val })}
                                />
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex items-center space-x-2">
                                <Switch checked={config.isBold} onCheckedChange={(c) => onChange({ ...config, isBold: c })} />
                                <Label>Bold</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Switch checked={config.isItalic} onCheckedChange={(c) => onChange({ ...config, isItalic: c })} />
                                <Label>Italic</Label>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="flex justify-between">
                                <span>텍스트 색상</span>
                                <span className="text-xs text-muted-foreground">{config.textColor}</span>
                            </Label>
                            <div className="flex gap-2">
                                <Input type="color" value={config.textColor} onChange={(e) => onChange({ ...config, textColor: e.target.value })} className="w-10 h-8 p-0 border-0" />
                                <Input value={config.textColor} onChange={(e) => onChange({ ...config, textColor: e.target.value })} className="flex-1 h-8" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>테두리 (Outline): {config.outlineSize}px</Label>
                            <div className="flex gap-2 items-center">
                                <Slider className="flex-1" value={[config.outlineSize]} min={0} max={10} step={0.5} onValueChange={([val]) => onChange({ ...config, outlineSize: val })} />
                                <Input type="color" value={config.outlineColor} onChange={(e) => onChange({ ...config, outlineColor: e.target.value })} className="w-8 h-8 p-0 border-0" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>그림자 (Shadow): {config.shadowSize}px</Label>
                            <div className="flex gap-2 items-center">
                                <Slider className="flex-1" value={[config.shadowSize]} min={0} max={20} step={1} onValueChange={([val]) => onChange({ ...config, shadowSize: val })} />
                                <Input type="color" value={config.shadowColor} onChange={(e) => onChange({ ...config, shadowColor: e.target.value })} className="w-8 h-8 p-0 border-0" />
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="position" className="space-y-4 py-2">
                        <div className="space-y-3 border p-3 rounded-md">
                            <div className="flex items-center justify-between">
                                <Label>배경 박스 사용 (Background Box)</Label>
                                <Switch checked={config.useBox} onCheckedChange={(c) => onChange({ ...config, useBox: c })} />
                            </div>
                            {config.useBox && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>색상</Label>
                                        <Input type="color" value={config.boxColor} onChange={(e) => onChange({ ...config, boxColor: e.target.value })} className="w-full h-8" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>투명도: {config.boxOpacity}%</Label>
                                        <Slider value={[config.boxOpacity]} min={0} max={100} step={5} onValueChange={([val]) => onChange({ ...config, boxOpacity: val })} />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>위치 (Position)</Label>
                            <div className="grid grid-cols-3 gap-2">
                                <Button variant={config.position === 'top' ? "default" : "outline"} onClick={() => onChange({ ...config, position: 'top' })} className="text-xs">Top</Button>
                                <Button variant={config.position === 'middle' ? "default" : "outline"} onClick={() => onChange({ ...config, position: 'middle' })} className="text-xs">Middle</Button>
                                <Button variant={config.position === 'bottom' ? "default" : "outline"} onClick={() => onChange({ ...config, position: 'bottom' })} className="text-xs">Bottom</Button>
                            </div>
                        </div>

                        {config.position !== 'custom' && (
                            <div className="space-y-2">
                                <Label>수직 여백 (Vertical Margin): {config.marginV}px</Label>
                                <Slider value={[config.marginV]} min={0} max={500} step={10} onValueChange={([val]) => onChange({ ...config, marginV: val })} />
                            </div>
                        )}

                        {config.position === 'custom' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>X 좌표</Label>
                                    <Input type="number" value={config.customX} onChange={(e) => onChange({ ...config, customX: Number(e.target.value) })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Y 좌표</Label>
                                    <Input type="number" value={config.customY} onChange={(e) => onChange({ ...config, customY: Number(e.target.value) })} />
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="animation" className="space-y-4 py-2">
                        {/* Entrance Animation */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-green-600">1. 등장 효과 (Entrance)</Label>
                            <Select
                                value={config.animationEntrance || 'none'}
                                onValueChange={(val) => onChange({ ...config, animationEntrance: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="등장 효과 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">없음 (None)</SelectItem>
                                    <SelectItem value="fade">페이드 인 (Fade In)</SelectItem>
                                    <SelectItem value="pop_up">팝업 (Pop Up)</SelectItem>
                                    <SelectItem value="elastic_pop">탄성 팝업 (Elastic Pop)</SelectItem>
                                    <SelectItem value="slide_up">위로 슬라이드 (Slide Up)</SelectItem>
                                    <SelectItem value="slide_down">아래로 슬라이드 (Slide Down)</SelectItem>
                                    <SelectItem value="slide_left">왼쪽으로 슬라이드 (Slide Left)</SelectItem>
                                    <SelectItem value="slide_right">오른쪽으로 슬라이드 (Slide Right)</SelectItem>
                                    <SelectItem value="mask_reveal">마스크 리빌 (Mask Reveal)</SelectItem>
                                    <SelectItem value="typewriter">타자기 (Typewriter)</SelectItem>
                                    <SelectItem value="blur_in">블러 인 (Blur In)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Exit Animation */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-red-600">2. 퇴장 효과 (Exit)</Label>
                            <Select
                                value={config.animationExit || 'none'}
                                onValueChange={(val) => onChange({ ...config, animationExit: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="퇴장 효과 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">없음 (None)</SelectItem>
                                    <SelectItem value="fade_out">페이드 아웃 (Fade Out)</SelectItem>
                                    <SelectItem value="zoom_out">줌 아웃 (Zoom Out)</SelectItem>
                                    <SelectItem value="slide_out_down">아래로 슬라이드 아웃 (Slide Out Down)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Emphasis Animation */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-blue-600">3. 강조 효과 (Emphasis)</Label>
                            <Select
                                value={config.animationEmphasis || 'none'}
                                onValueChange={(val) => onChange({ ...config, animationEmphasis: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="강조 효과 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">없음 (None)</SelectItem>
                                    <SelectItem value="pulse">펄스/하트비트 (Pulse)</SelectItem>
                                    <SelectItem value="shake">쉐이크 (Shake)</SelectItem>
                                    <SelectItem value="flip_x">가로 회전 (3D Flip X)</SelectItem>
                                    <SelectItem value="flip_y">세로 회전 (3D Flip Y)</SelectItem>
                                    <SelectItem value="spin_z">풍차 회전 (3D Spin Z)</SelectItem>
                                    <SelectItem value="neon">네온 (Neon)</SelectItem>
                                    <SelectItem value="spacing">자간 넓히기 (Spacing)</SelectItem>
                                    <SelectItem value="color_morph">색상 변환 (Color Morph)</SelectItem>
                                    <SelectItem value="bounce">바운스 (Bounce)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>자막 분절 길이 (Split Limit): {config.splitLimit}자</Label>
                            <p className="text-[11px] text-muted-foreground">
                                한 줄에 표시할 최대 글자 수입니다. 이 길이를 넘으면 자동으로 줄바꿈됩니다.
                            </p>
                            <Slider value={[config.splitLimit]} min={5} max={50} step={1} onValueChange={([val]) => onChange({ ...config, splitLimit: val })} />
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>Shorts (10-15)</span>
                                <span>Standard (20-30)</span>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};

export default SubtitleSettingsPanel;
