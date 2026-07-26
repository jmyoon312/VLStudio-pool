from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from .. import crud, database, models
from ..llm_manager import LLMClient

router = APIRouter(tags=["research"])

# ── Existing Manual Research Brief ──

class ResearchRequest(BaseModel):
    topic: str
    niche: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None

class ResearchResponse(BaseModel):
    topic: str
    summary: str
    sources: list
    key_findings: str
    model_used: str

@router.post("/research/brief", response_model=ResearchResponse)
def generate_research_brief(
    request: ResearchRequest,
    db: Session = Depends(database.get_db)
):
    settings = crud.get_settings(db)
    llm_client = LLMClient(settings)
    from app.services.intelligence.research_brain.model_resolver import resolve_agent_model
    provider = request.provider or getattr(settings, "openclaw_preferred_provider", "auto")
    model = request.model or resolve_agent_model(settings)

    search_query = f"{request.topic} {request.niche or ''} insights trends 2026"
    try:
        from app.services.tool_manager import tool_manager
        search_result = tool_manager.search(
            search_query,
            include_images=False,
            settings=settings,
            time_range='year'
        )
        raw_results = search_result.get("results", [])
    except Exception as e:
        raw_results = []

    top_results = raw_results[:8]
    sources = [
        {"title": r.get("title", ""), "url": r.get("url", ""), "snippet": r.get("content", "")[:200]}
        for r in top_results
    ]

    if not top_results:
        return ResearchResponse(
            topic=request.topic,
            summary=f"No web results found for '{request.topic}'. Try a broader search term.",
            sources=[],
            key_findings="No data available.",
            model_used="none"
        )

    web_context = "\n\n".join(
        f"[{i+1}] {r['title']}\n{r.get('content', '')[:500]}"
        for i, r in enumerate(top_results)
    )

    system_prompt = (
        "You are a Strategic Research Analyst. Your task is to synthesize web search results "
        "into a concise, actionable research brief.\n\n"
        "Output STRICTLY in this format (plain text, no markdown):\n"
        "=== KEY FINDINGS ===\n"
        "<3-5 bullet points of the most important findings>\n\n"
        "=== SUMMARY ===\n"
        "<2-3 paragraph summary covering:\n"
        "- Current state/statistics\n"
        "- Key trends or developments\n"
        "- Controversies or debates\n"
        "- Future outlook>\n"
    )

    user_prompt = f"### TOPIC: {request.topic}\n### NICHE: {request.niche or 'General'}\n\n### WEB RESEARCH:\n{web_context}"

    try:
        result = llm_client.generate_content(
            prompt=user_prompt,
            model_name=model,
            system_instruction=system_prompt,
            full_response=True
        )
        content = result.get("content", result) if isinstance(result, dict) else result
        actual_model = result.get("model", model) if isinstance(result, dict) else model

        key_findings = ""
        summary = content
        if "=== KEY FINDINGS ===" in content:
            parts = content.split("=== KEY FINDINGS ===")
            if len(parts) > 1:
                sub_parts = parts[1].split("=== SUMMARY ===")
                key_findings = sub_parts[0].strip()
                summary = sub_parts[1].strip() if len(sub_parts) > 1 else content
    except Exception as e:
        content = f"LLM synthesis failed: {e}"
        actual_model = model
        key_findings = ""
        summary = content

    return ResearchResponse(
        topic=request.topic,
        summary=summary,
        sources=sources,
        key_findings=key_findings,
        model_used=actual_model
    )


# ── Research Intelligence APIs ──

# --- Pydantic schemas ---

class NicheResponse(BaseModel):
    id: int
    name: str
    description: str
    category: Optional[str]
    avg_viral_score: float
    keyword_count: int
    topic_count: int
    status: str
    discovered_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class TopicResponse(BaseModel):
    id: int
    niche_id: int
    niche_name: Optional[str] = None
    title: str
    research_question: str
    priority: int
    status: str
    created_at: datetime
    scheduled_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ReportResponse(BaseModel):
    id: int
    topic_id: int
    topic_title: Optional[str] = None
    niche_name: Optional[str] = None
    summary: str
    key_findings: str
    sources_json: list
    model_used: str
    created_at: datetime
    # [Research Brain] structured brief metadata
    production_readiness: float = 0.0
    gate_status: str = ""
    research_depth: int = 0
    has_brief: bool = False

    class Config:
        from_attributes = True


# --- Endpoints ---

@router.get("/research/niches", response_model=list[NicheResponse])
def list_niches(
    status: Optional[str] = Query(None, description="Filter by status"),
    db: Session = Depends(database.get_db)
):
    q = db.query(models.ResearchNiche)
    if status:
        q = q.filter(models.ResearchNiche.status == status)
    niches = q.order_by(models.ResearchNiche.avg_viral_score.desc()).all()
    result = []
    for n in niches:
        topic_count = db.query(models.ResearchTopic).filter(
            models.ResearchTopic.niche_id == n.id
        ).count()
        result.append(NicheResponse(
            id=n.id,
            name=n.name,
            description=n.description or "",
            category=n.category,
            avg_viral_score=n.avg_viral_score or 0.0,
            keyword_count=n.keyword_count or 0,
            topic_count=topic_count,
            status=n.status,
            discovered_at=n.discovered_at,
            updated_at=n.updated_at
        ))
    return result


@router.get("/research/topics", response_model=list[TopicResponse])
def list_topics(
    niche_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None, description="pending, in_progress, completed, dismissed"),
    limit: int = Query(50, le=200),
    db: Session = Depends(database.get_db)
):
    q = db.query(models.ResearchTopic).options(joinedload(models.ResearchTopic.niche))
    if niche_id:
        q = q.filter(models.ResearchTopic.niche_id == niche_id)
    if status:
        q = q.filter(models.ResearchTopic.status == status)
    topics = q.order_by(models.ResearchTopic.priority.desc()).limit(limit).all()
    return [
        TopicResponse(
            id=t.id,
            niche_id=t.niche_id,
            niche_name=t.niche.name if t.niche else None,
            title=t.title,
            research_question=t.research_question or "",
            priority=t.priority or 50,
            status=t.status,
            created_at=t.created_at,
            scheduled_at=t.scheduled_at,
            completed_at=t.completed_at
        )
        for t in topics
    ]


@router.get("/research/topics/{topic_id}", response_model=TopicResponse)
def get_topic(topic_id: int, db: Session = Depends(database.get_db)):
    topic = db.query(models.ResearchTopic).options(
        joinedload(models.ResearchTopic.niche)
    ).filter(models.ResearchTopic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return TopicResponse(
        id=topic.id,
        niche_id=topic.niche_id,
        niche_name=topic.niche.name if topic.niche else None,
        title=topic.title,
        research_question=topic.research_question or "",
        priority=topic.priority or 50,
        status=topic.status,
        created_at=topic.created_at,
        scheduled_at=topic.scheduled_at,
        completed_at=topic.completed_at
    )


@router.get("/research/reports", response_model=list[ReportResponse])
def list_reports(
    limit: int = Query(20, le=100),
    db: Session = Depends(database.get_db)
):
    reports = db.query(models.ResearchReport).options(
        joinedload(models.ResearchReport.topic).joinedload(models.ResearchTopic.niche)
    ).order_by(models.ResearchReport.created_at.desc()).limit(limit).all()
    return [
        ReportResponse(
            id=r.id,
            topic_id=r.topic_id,
            topic_title=r.topic.title if r.topic else None,
            niche_name=r.topic.niche.name if r.topic and r.topic.niche else None,
            summary=r.summary or "",
            key_findings=r.key_findings or "",
            sources_json=r.sources_json or [],
            model_used=r.model_used or "",
            created_at=r.created_at,
            production_readiness=getattr(r, "production_readiness", 0.0) or 0.0,
            gate_status=getattr(r, "gate_status", "") or "",
            research_depth=getattr(r, "research_depth", 0) or 0,
            has_brief=bool(getattr(r, "brief_json", None)),
        )
        for r in reports
    ]


@router.get("/research/reports/{report_id}", response_model=ReportResponse)
def get_report(report_id: int, db: Session = Depends(database.get_db)):
    report = db.query(models.ResearchReport).options(
        joinedload(models.ResearchReport.topic).joinedload(models.ResearchTopic.niche)
    ).filter(models.ResearchReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return ReportResponse(
        id=report.id,
        topic_id=report.topic_id,
        topic_title=report.topic.title if report.topic else None,
        niche_name=report.topic.niche.name if report.topic and report.topic.niche else None,
        summary=report.summary or "",
        key_findings=report.key_findings or "",
        sources_json=report.sources_json or [],
        model_used=report.model_used or "",
        created_at=report.created_at,
        production_readiness=getattr(report, "production_readiness", 0.0) or 0.0,
        gate_status=getattr(report, "gate_status", "") or "",
        research_depth=getattr(report, "research_depth", 0) or 0,
        has_brief=bool(getattr(report, "brief_json", None)),
    )


@router.post("/research/topics/generate")
def trigger_topic_generation(db: Session = Depends(database.get_db)):
    """Manually trigger topic generation. If no niches exist yet, bootstrap them
    from trends first (niche discovery), then generate topics."""
    try:
        from app.scheduler import generate_research_topics, discover_niches
        import threading
        active_niches = db.query(models.ResearchNiche).filter(
            models.ResearchNiche.status == "active"
        ).count()
        trend_count = db.query(models.Trend).count()

        def _job():
            if active_niches == 0:
                discover_niches()  # bootstrap niches from trends
            generate_research_topics()

        threading.Thread(target=_job, daemon=True).start()
        if active_niches == 0 and trend_count == 0:
            msg = "트렌드 데이터가 없어 니치를 만들 수 없습니다. 먼저 트렌드 수집을 실행하세요."
        elif active_niches == 0:
            msg = f"니치 발견({trend_count}개 트렌드) 후 주제 생성을 시작합니다 (최대 1분 소요)"
        else:
            msg = f"{active_niches}개 니치에서 주제 생성을 시작합니다"
        return {"status": "started", "message": msg, "niche_count": active_niches, "trend_count": trend_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/research/trigger")
def trigger_research_execution(
    topic_id: Optional[int] = None,
    db: Session = Depends(database.get_db)
):
    """Manually trigger research execution. For a specific topic, run it directly.
    Otherwise auto-pick the highest-priority pending topic — bootstrapping the full
    chain (niche discovery -> topic generation) first if nothing is queued."""
    from app.scheduler import execute_research_brief, generate_research_topics, discover_niches
    import threading

    if topic_id:
        topic = db.query(models.ResearchTopic).filter(models.ResearchTopic.id == topic_id).first()
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")
        topic.status = "pending"
        topic.priority = 100  # Force priority
        db.commit()

    pending = db.query(models.ResearchTopic).filter(
        models.ResearchTopic.status == "pending"
    ).count()
    active_niches = db.query(models.ResearchNiche).filter(
        models.ResearchNiche.status == "active"
    ).count()
    trend_count = db.query(models.Trend).count()
    needs_bootstrap = (not topic_id) and pending == 0

    def _job():
        if needs_bootstrap:
            if active_niches == 0:
                discover_niches()
            generate_research_topics()
        execute_research_brief()

    threading.Thread(target=_job, daemon=True).start()

    if needs_bootstrap and active_niches == 0 and trend_count == 0:
        msg = "대기 주제·니치·트렌드가 모두 없습니다. 먼저 트렌드 수집을 실행하세요."
    elif needs_bootstrap:
        msg = "대기 주제가 없어 니치 발견 → 주제 생성 → 리서치를 순차 실행합니다 (최대 1-2분 소요)"
    elif topic_id:
        msg = f"주제 #{topic_id} 리서치를 시작합니다 (최대 1분 소요)"
    else:
        msg = f"대기 주제 {pending}개 중 최우선 주제 리서치를 시작합니다 (최대 1분 소요)"
    return {"status": "started", "message": msg,
            "pending_topics": pending, "niche_count": active_niches, "trend_count": trend_count}


@router.delete("/research/topics/{topic_id}")
def dismiss_topic(topic_id: int, db: Session = Depends(database.get_db)):
    topic = db.query(models.ResearchTopic).filter(models.ResearchTopic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    topic.status = "dismissed"
    db.commit()
    return {"status": "dismissed"}


# ──────────────────────────────────────────────
# Research Brain — Structured Production Briefs
# ──────────────────────────────────────────────

@router.get("/research/briefs/{report_id}")
def get_brief(report_id: int, db: Session = Depends(database.get_db)):
    """Return the full structured ProductionResearchBrief for a report."""
    report = db.query(models.ResearchReport).filter(models.ResearchReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    brief = getattr(report, "brief_json", None)
    if not brief:
        raise HTTPException(status_code=404, detail="No structured brief for this report")
    return {
        "report_id": report.id,
        "production_readiness": getattr(report, "production_readiness", 0.0) or 0.0,
        "gate_status": getattr(report, "gate_status", "") or "",
        "research_depth": getattr(report, "research_depth", 0) or 0,
        "brief": brief,
    }


class DeepResearchRequest(BaseModel):
    topic: str
    niche: Optional[str] = "General"
    max_loops: Optional[int] = 3
    reference_url: Optional[str] = None


@router.post("/research/brief/deep")
def trigger_deep_research(
    request: DeepResearchRequest,
    db: Session = Depends(database.get_db),
):
    """Run the full Research Brain (deep loop -> compile -> gate) for a topic in the
    background and persist the result as a ResearchReport with a structured brief."""
    settings = crud.get_settings(db)

    def _run(topic: str, niche: str, max_loops: int, reference_url: str):
        from app.database import SessionLocal
        from app.services.intelligence.research_brain.orchestrator import build_default_brain
        inner = SessionLocal()
        try:
            s = crud.get_settings(inner)
            brain = build_default_brain(s, max_loops=max_loops)
            brief = brain.run(topic, niche=niche, reference_url=reference_url)
            _persist_brief_report(inner, topic, niche, brief)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"[deep research] failed: {e}")
        finally:
            inner.close()

    import threading
    threading.Thread(
        target=_run,
        args=(request.topic, request.niche or "General", request.max_loops or 3, request.reference_url),
        daemon=True,
    ).start()
    return {"status": "started", "message": f"Deep research started for '{request.topic}'"}


def _persist_brief_report(db: Session, topic: str, niche: str, brief) -> "models.ResearchReport":
    """Persist a ProductionResearchBrief as a ResearchReport (+ ad-hoc topic/niche)."""
    # Find or create a niche + topic so the report fits the existing schema.
    niche_row = db.query(models.ResearchNiche).filter(models.ResearchNiche.name == niche).first()
    if not niche_row:
        niche_row = models.ResearchNiche(name=niche or "General", description="", status="active")
        db.add(niche_row)
        db.flush()
    topic_row = models.ResearchTopic(
        niche_id=niche_row.id, title=topic[:120], research_question=topic,
        priority=70, status="completed", completed_at=datetime.now(),
    )
    db.add(topic_row)
    db.flush()

    # Backward-compatible text summary derived from the brief.
    key_findings = "\n".join(f"- {c.claim}" + (f" [{c.exact_stat}]" if c.exact_stat else "")
                             for c in brief.atomic_claims[:6])
    best = brief.best_hook()
    summary = f"Angle: {brief.angle}\nPromise: {brief.promise}\nBest hook: {best.text if best else '-'}"

    report = models.ResearchReport(
        topic_id=topic_row.id,
        summary=summary,
        key_findings=key_findings,
        sources_json=[{"title": c.source_title, "url": c.source_url} for c in brief.atomic_claims if c.source_url],
        model_used="research-brain",
        brief_json=brief.model_dump(mode="json"),
        research_depth=getattr(brief, "research_depth", 0) or 0,
        production_readiness=brief.production_readiness,
        gate_status=brief.gate.status if brief.gate else "",
    )
    db.add(report)
    db.commit()
    return report


# ──────────────────────────────────────────────
# Reference Videos (link + metadata + transcript only)
# ──────────────────────────────────────────────

@router.get("/research/reference-videos")
def list_reference_videos(
    niche: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: Session = Depends(database.get_db),
):
    q = db.query(models.ReferenceVideo)
    if niche:
        q = q.filter(models.ReferenceVideo.niche == niche)
    rows = q.order_by(models.ReferenceVideo.viral_score.desc()).limit(limit).all()
    return [
        {
            "id": r.id, "url": r.url, "platform": r.platform,
            "channel_name": r.channel_name, "channel_url": r.channel_url,
            "title": r.title, "view_count": r.view_count, "like_count": r.like_count,
            "duration": r.duration, "thumbnail_url": r.thumbnail_url,
            "niche": r.niche, "viral_score": r.viral_score, "status": r.status,
            "collected_at": r.collected_at,
        }
        for r in rows
    ]


class ReferenceVideoRequest(BaseModel):
    url: str
    niche: Optional[str] = ""


@router.post("/research/reference-videos")
def add_reference_video(req: ReferenceVideoRequest, db: Session = Depends(database.get_db)):
    """Collect channel info + metadata + transcript for a public video link."""
    from app.services.intelligence.research_brain.source_assets import ReferenceCollector
    existing = db.query(models.ReferenceVideo).filter(models.ReferenceVideo.url == req.url).first()
    collector = ReferenceCollector()
    meta = collector.collect(req.url)
    if meta.get("error") and not existing:
        raise HTTPException(status_code=422, detail=f"Failed to collect: {meta['error']}")
    score = ReferenceCollector.compute_viral_score(meta)
    row = existing or models.ReferenceVideo(url=req.url)
    row.platform = meta.get("platform", "youtube")
    row.channel_name = meta.get("channel_name", "")
    row.channel_url = meta.get("channel_url", "")
    row.title = meta.get("title", "")
    row.view_count = meta.get("view_count", 0)
    row.like_count = meta.get("like_count", 0)
    row.comment_count = meta.get("comment_count", 0)
    row.duration = meta.get("duration", 0)
    row.thumbnail_url = meta.get("thumbnail_url", "")
    row.lang = meta.get("lang", "")
    row.niche = req.niche or row.niche or ""
    row.viral_score = score
    if not existing:
        db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "title": row.title, "channel_name": row.channel_name,
            "view_count": row.view_count, "viral_score": row.viral_score}


@router.delete("/research/reference-videos/{video_id}")
def delete_reference_video(video_id: int, db: Session = Depends(database.get_db)):
    row = db.query(models.ReferenceVideo).filter(models.ReferenceVideo.id == video_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(row)
    db.commit()
    return {"status": "deleted"}


# ──────────────────────────────────────────────
# Source Assets (legal stock search + save)
# ──────────────────────────────────────────────

def _build_stock_connector(settings):
    from app.services.intelligence.research_brain.source_assets import StockConnector
    def _first(keys):
        if isinstance(keys, list) and keys:
            return keys[0]
        return ""
    return StockConnector(
        pexels_key=_first(getattr(settings, "pexels_api_keys", [])),
        pixabay_key=_first(getattr(settings, "pixabay_api_keys", [])),
    )


class StockSearchRequest(BaseModel):
    query: str
    provider: Optional[str] = "pexels"
    per_page: Optional[int] = 6
    orientation: Optional[str] = "portrait"


@router.post("/research/source-assets/search")
def search_source_assets(req: StockSearchRequest, db: Session = Depends(database.get_db)):
    settings = crud.get_settings(db)
    conn = _build_stock_connector(settings)
    try:
        results = conn.search(
            req.query, provider=req.provider or "pexels",
            per_page=req.per_page or 6, orientation=req.orientation or "portrait",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"query": req.query, "provider": req.provider, "results": results}


@router.get("/research/source-assets")
def list_source_assets(
    brief_id: Optional[int] = Query(None),
    limit: int = Query(50, le=200),
    db: Session = Depends(database.get_db),
):
    q = db.query(models.SourceAsset)
    if brief_id:
        q = q.filter(models.SourceAsset.brief_id == brief_id)
    rows = q.order_by(models.SourceAsset.created_at.desc()).limit(limit).all()
    return [
        {
            "id": r.id, "provider": r.provider, "source_url": r.source_url,
            "preview_url": r.preview_url, "local_path": r.local_path,
            "media_type": r.media_type, "license": r.license, "attribution": r.attribution,
            "query": r.query, "brief_id": r.brief_id, "downloaded": r.downloaded,
            "duration": r.duration, "width": r.width, "height": r.height,
        }
        for r in rows
    ]


class SaveAssetRequest(BaseModel):
    provider: str
    source_url: str
    preview_url: Optional[str] = ""
    media_type: Optional[str] = "video"
    license: Optional[str] = ""
    attribution: Optional[str] = ""
    query: Optional[str] = ""
    brief_id: Optional[int] = None
    duration: Optional[int] = 0
    width: Optional[int] = 0
    height: Optional[int] = 0


@router.post("/research/source-assets")
def save_source_asset(req: SaveAssetRequest, db: Session = Depends(database.get_db)):
    row = models.SourceAsset(
        provider=req.provider, source_url=req.source_url, preview_url=req.preview_url or "",
        media_type=req.media_type or "video", license=req.license or "",
        attribution=req.attribution or "", query=req.query or "", brief_id=req.brief_id,
        duration=req.duration or 0, width=req.width or 0, height=req.height or 0,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "provider": row.provider, "license": row.license}
