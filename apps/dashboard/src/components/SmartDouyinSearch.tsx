import React, { useState, useMemo } from 'react';
import { Sparkles, Download, Play, FolderOpen, Globe, Loader2, Trash2, Scissors, CheckCheck, X } from 'lucide-react';

const CATEGORIES = [
  { id: 'family', name: '가족갈등', stars: ['婆媳关系','母爱感人'], cores: ['偏心','争遗产','不孝子'] },
  { id: 'reversal', name: '신분반전', stars: ['吊丝逆袭','隐姓埋名'], cores: ['首富','装穷','打脸','战神归来'] },
  { id: 'betrayal', name: '불륜복수', stars: ['出轨','手撕小三'], cores: ['渣男','净身出户','撕绿茶'] },
  { id: 'timeslip', name: '회귀·빙의', stars: ['重生'], cores: ['穿越','逆袭人生','虐渣'] },
  { id: 'tender', name: '모성·감동', stars: ['单亲妈妈','孤儿抚养'], cores: ['感人','养母之情'] },
];

const PROGRESS_ENV = ['idle','searching','downloading','downloaded_ready','editing','editing_done'];

export default function SmartDouyinSearch() {
  const [selected, setSelected] = useState<string[]>(['family']);
  const [aiKeys, setAiKeys] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [minDur, setMinDur] = useState(60);
  const [maxDur, setMaxDur] = useState(300);
  const [dateAfter, setDateAfter] = useState('20250101');
  const [count, setCount] = useState(5);
  const [deep, setDeep] = useState(false);

  const [jobId, setJobId] = useState<number | null>(null);
  const [jobStatus, setJobStatus] = useState('idle');
  const [videos, setVideos] = useState<any[]>([]);
  const [totalVideos, setTotalVideos] = useState(0);
  const [processMsg, setProcessMsg] = useState('');
  const [exportMsg, setExportMsg] = useState('');
  const [selectAll, setSelectAll] = useState(true);
  const [timerId, setTimerId] = useState<ReturnType<typeof setInterval> | null>(null);

  const allKeywords = useMemo(() => {
    const kw: string[] = [];
    selected.forEach(cid => { const cat = CATEGORIES.find(c => c.id === cid); if (cat) kw.push(...cat.stars, ...cat.cores); });
    aiKeys.forEach(k => { if (!kw.includes(k)) kw.push(k); });
    return [...new Set(kw)].slice(0, 15);
  }, [selected, aiKeys]);

  const selectedVideos = useMemo(() => videos.filter(v => v.selected), [videos]);

  async function doPoll(jid: number) {
    try {
      const r = await fetch(`/api/douyin-shorts/${jid}`);
      const data = await r.json();
      setJobStatus(data.status);
      setTotalVideos(data.total_videos ?? 0);
      if (data.videos?.length) {
        setVideos(data.videos.map((v: any) => ({ ...v, selected: v.selected !== false })));
      }
      if (data.status === 'downloaded_ready' || data.status === 'editing_done') {
        if (timerId) clearInterval(timerId);
        setProcessMsg(`완료: ${data.total_videos}개 다운로드됨`);
      }
    } catch {
      setProcessMsg('poll 오류');
    }
  }

  function startPolling(jid: number) {
    if (timerId) clearInterval(timerId);
    doPoll(jid);
    const id = setInterval(() => doPoll(jid), 2000);
    setTimerId(id);
  }

  React.useEffect(() => { return () => { if (timerId) clearInterval(timerId); }; }, [timerId]);

  const handleSearch = async () => {
    if (allKeywords.length === 0) { alert('키워드 없음'); return; }
    setJobStatus('searching');
    setProcessMsg('검색 요청 중...');
    setVideos([]);
    setTotalVideos(0);
    try {
      const res = await fetch('/api/douyin-shorts/start-search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword_seeds: allKeywords, category_tags: selected, min_duration_sec: minDur, max_duration_sec: maxDur, date_after: dateAfter, download_count: count, channel_deep: deep, expand_with_ai: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setJobId(data.job_id);
      setProcessMsg(`다운로드 중... Job #${data.job_id}`);
      startPolling(data.job_id);
    } catch (e: any) {
      setJobStatus('error');
      setProcessMsg('에러: ' + e.message);
    }
  };

  const handleEdit = async () => {
    if (!jobId || selectedVideos.length === 0) return;
    const indices = selectedVideos.map(v => v.idx);
    setJobStatus('editing');
    setProcessMsg('편집 중...');
    await fetch('/api/douyin-shorts/process-batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job_id: jobId, target_video_indices: indices }) });
    setProcessMsg('편집 시작됨');
  };

  const handleExport = async () => {
    if (!jobId) return;
    setExportMsg('내보내기 요청 중...');
    await fetch('/api/douyin-shorts/export-capcut', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job_id: jobId, video_indices: selectedVideos.map(v => v.idx) }) });
    setExportMsg('CapCut 프로젝트 준복');
  };

  const handleDelete = async (indices: number[]) => {
    if (!jobId) return;
    await fetch('/api/douyin-shorts/delete-videos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job_id: jobId, indices }) });
    setVideos(prev => prev.filter(v => !indices.includes(v.idx)));
  };

  const isWorking = jobStatus === 'searching' || jobStatus === 'downloading' || jobStatus === 'editing';
  const progressPct = totalVideos > 0 ? Math.round((videos.length / totalVideos) * 100) : 0;

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>
        <Globe style={{ display: 'inline', marginRight: '8px', color: '#f97316' }} />
        더우인 쇼츠 스마트 수집 & 편집
      </h1>
      <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px' }}>카테고리 선택 → 검색 다운로드 → 편집 → CapCut</p>

      {/* ── 진행 상태 바 ── */}
      {jobId && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isWorking ? <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite', color: '#f97316' }} /> : <Check style={{ width: '16px', height: '16px', color: '#10b981' }} />}
              <span style={{ fontWeight: 600, fontSize: '14px' }}>Job #{jobId} · {jobStatus}</span>
            </div>
            <span style={{ fontSize: '13px', color: '#64748b' }}>{videos.length} / {totalVideos} videos</span>
          </div>
          <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${isWorking && totalVideos === 0 ? 30 : progressPct}%`, height: '100%', background: isWorking ? '#f97316' : '#10b981', borderRadius: '3px', transition: 'width 0.5s' }} />
          </div>
          <div style={{ marginTop: '6px', fontSize: '12px', color: '#64748b' }}>{processMsg}</div>
          {exportMsg && <div style={{ fontSize: '12px', color: '#059669', marginTop: '4px' }}>{exportMsg}</div>}
        </div>
      )}

      {/* 카테고리 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
        {CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setSelected(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])}
            style={{ padding: '6px 14px', borderRadius: '10px', border: selected.includes(c.id) ? '2px solid #f97316' : '1px solid #d1d5db', background: selected.includes(c.id) ? '#fff7ed' : '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: selected.includes(c.id) ? '#c2410c' : '#374151' }}>{c.name}</button>
        ))}
      </div>

      {/* 설정 + 버튼 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '14px', alignItems: 'end' }}>
        <div>
          <label style={{ fontSize: '11px', display: 'block', marginBottom: '2px', color: '#6b7280' }}>길이(초)</label>
          <div style={{ display: 'flex', gap: '4px' }}>
            <input type="number" value={minDur} onChange={e => setMinDur(Number(e.target.value))} style={{ width: 70, padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }} />
            <input type="number" value={maxDur} onChange={e => setMaxDur(Number(e.target.value))} style={{ width: 70, padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }} />
          </div>
        </div>
        <div><label style={{ fontSize: '11px', display: 'block', marginBottom: '2px', color: '#6b7280' }}>수량</label><input type="number" value={count} onChange={e => setCount(Number(e.target.value))} style={{ width: 80, padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }} /></div>
        <div><label style={{ fontSize: '11px', display: 'block', marginBottom: '2px', color: '#6b7280' }}>날짜</label><input value={dateAfter} onChange={e => setDateAfter(e.target.value)} style={{ width: 100, padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }} /></div>
        <button onClick={() => { setAiLoading(true); fetch('/api/douyin-shorts/expand-keywords', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyword_seeds: allKeywords.slice(0,5), category_tags: selected, n:5 }) }).then(r => r.json()).then(d => { setAiKeys(d.additional || []); setAiLoading(false); }).catch(() => setAiLoading(false)); }} disabled={aiLoading}
          style={{ padding: '5px 14px', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '12px' }}>
          <Sparkles style={{ width: '14px', height: '14px', verticalAlign: 'middle', marginRight: '4px' }} />{aiLoading ? '...' : 'AI 확장'}
        </button>
        <button onClick={handleSearch} disabled={isWorking}
          style={{ padding: '8px 24px', border: 'none', borderRadius: '8px', background: isWorking ? '#d1d5db' : '#f97316', color: '#fff', cursor: isWorking ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 600, marginLeft: 'auto' }}>
          {isWorking ? <Loader2 style={{ width: '14px', height: '14px', verticalAlign: 'middle', marginRight: '4px', animation: 'spin 1s linear infinite' }} /> : <Download style={{ width: '14px', height: '14px', verticalAlign: 'middle', marginRight: '4px' }} />}
          {isWorking ? '처리 중...' : '검색 및 다운로드'}
        </button>
        <button onClick={handleEdit} disabled={!jobId || selectedVideos.length === 0} style={{ padding: '8px 18px', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', cursor: !jobId ? 'not-allowed' : 'pointer', fontSize: '13px' }}>
          <Scissors style={{ width: '12px', height: '12px', verticalAlign: 'middle', marginRight: '4px' }} />편집 ({selectedVideos.length})
        </button>
        <button onClick={handleExport} disabled={!jobId} style={{ padding: '8px 18px', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', cursor: !jobId ? 'not-allowed' : 'pointer', fontSize: '13px' }}>
          <FolderOpen style={{ width: '12px', height: '12px', verticalAlign: 'middle', marginRight: '4px' }} />CapCut
        </button>
      </div>

      {aiKeys.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>{aiKeys.map((k,i)=>(<span key={i} style={{ padding: '2px 10px', background: '#dcfce7', color: '#166534', borderRadius: '999px', fontSize: '11px' }}>{k}</span>))}</div>}

      {/* 키워드 */}
      {allKeywords.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px', fontSize: '11px' }}>{allKeywords.map((k,i)=>(<span key={i} style={{ padding: '3px 10px', background: '#f1f5f9', border:'1px solid #e2e8f0', borderRadius: '999px' }}>{k}</span>))}</div>}

      {/* VIDEO TABLE */}
      {videos.length > 0 && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '12px' }}>
            <input type="checkbox" checked={selectAll} onChange={() => { const n = !selectAll; setSelectAll(n); setVideos(prev => prev.map(v => ({ ...v, selected: n }))); }} />
            <span>{selectedVideos.length} / {videos.length}</span>
            <div style={{ flex: 1 }} />
            <button onClick={() => handleDelete(selectedVideos.map(v => v.idx))} disabled={selectedVideos.length === 0}
              style={{ padding: '3px 10px', border: '1px solid #fecaca', borderRadius: '6px', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '11px' }}>
              <Trash2 style={{ width: '10px', height: '10px', verticalAlign: 'middle', marginRight: '3px' }} />삭제
            </button>
          </div>
          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            {videos.map(v => (
              <div key={v.idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 14px', borderBottom: '1px solid #f3f4f6', fontSize: '12px' }}>
                <input type="checkbox" checked={v.selected} onChange={() => setVideos(prev => prev.map(o => o.idx === v.idx ? { ...o, selected: !o.selected } : o))} />
                <img src={v.thumbnail || 'https://via.placeholder.com/96x54?text=img'} style={{ width: '64px', height: '36px', objectFit:'cover', borderRadius:'4px', background:'#e5e7eb' }} alt="" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={v.title}>{v.title}</div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', display: 'flex', gap: '10px', marginTop: '2px' }}>
                    <span>{v.uploader}</span>
                    <span>{v.duration_fmt}</span>
                    {v.view_count > 0 && <span>{(v.view_count/10000).toFixed(1)}만</span>}
                  </div>
                </div>
                {v.editing === 'done' && <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: '#dcfce7', color: '#16a34a' }}>편집완료</span>}
                <button onClick={() => handleDelete([v.idx])} style={{ padding: '2px 6px', border: 'none', background: 'transparent', color: '#d1d5db', cursor: 'pointer', fontSize: '16px' }} title="삭제">×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* spinner */}
      {isWorking && videos.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#f97316' }}>
          <Loader2 style={{ width: '32px', height: '32px', animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
          <p>더우인에서 영상 다운로드 중... 잠시만 기다려주세요.</p>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}