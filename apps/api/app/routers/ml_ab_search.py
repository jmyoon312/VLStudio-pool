"""
ML, A/B Testing, Search & Recommendation API Router

Endpoints:
- POST /api/ml/train - Train model
- POST /api/ml/predict - Make prediction
- GET /api/ml/models - List models
- GET /api/ml/models/{model_id} - Get model details

- POST /api/experiments - Create experiment
- POST /api/experiments/{id}/start - Start experiment
- GET /api/experiments/{id}/variant - Get variant
- POST /api/experiments/{id}/convert - Record conversion
- GET /api/experiments/{id}/results - Get results

- GET /api/search - Search content
- POST /api/search/index - Index content
- GET /api/search/autocomplete - Autocomplete

- GET /api/recommendations - Get recommendations
- POST /api/recommendations/preferences - Update preferences
- GET /api/recommendations/similar - Get similar content
- GET /api/recommendations/trending - Get trending
"""

from fastapi import APIRouter, HTTPException
from typing import Optional, List
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["ml_ab_search_recommendation"])

# ==================== ML Pipeline ====================

class TrainModelRequest(BaseModel):
    name: str
    model_type: str
    features: List[str]
    labels: List[str]
    config: dict = {}

class PredictRequest(BaseModel):
    features: dict

def get_ml_pipeline():
    from app.services.ml_pipeline import get_ml_pipeline
    return get_ml_pipeline()

@router.post("/ml/train")
async def train_model(request: TrainModelRequest):
    """Train a ML model"""
    from app.services.ml_pipeline import ModelType
    
    ml = get_ml_pipeline()
    model_type = ModelType(request.model_type)
    
    model_id = await ml.train(
        name=request.name,
        model_type=model_type,
        features=request.features,
        labels=request.labels,
        config=request.config
    )
    
    return {"model_id": model_id, "status": "training"}

@router.post("/ml/predict")
async def predict(model_id: str, request: PredictRequest):
    """Make prediction"""
    ml = get_ml_pipeline()
    result = await ml.predict(model_id, request.features)
    
    if not result:
        raise HTTPException(status_code=404, message="Model not found or not ready")
    
    return result

@router.get("/ml/models")
async def list_models(name: str = None):
    """List models"""
    ml = get_ml_pipeline()
    models = ml.list_models(name)
    return {"data": models}

@router.get("/ml/models/{model_id}")
async def get_model(model_id: str):
    """Get model details"""
    ml = get_ml_pipeline()
    model = ml.get_model(model_id)
    
    if not model:
        raise HTTPException(status_code=404, message="Model not found")
    
    return {
        "model_id": model.model_id,
        "name": model.name,
        "version": model.version,
        "status": model.status.value,
        "accuracy": model.accuracy,
        "f1_score": model.f1_score,
        "metrics": model.metrics
    }

@router.get("/ml/latest/{name}")
async def get_latest_model(name: str):
    """Get latest model version"""
    ml = get_ml_pipeline()
    model = ml.get_latest_model(name)
    
    if not model:
        raise HTTPException(status_code=404, message="Model not found")
    
    return {"model_id": model.model_id, "version": model.version}

# ==================== A/B Testing ====================

class CreateExperimentRequest(BaseModel):
    name: str
    variants: dict  # variant -> traffic percentage

def get_ab_testing():
    from app.services.ab_testing import get_ab_testing
    return get_ab_testing()

@router.post("/experiments")
async def create_experiment(request: CreateExperimentRequest):
    """Create A/B experiment"""
    ab = get_ab_testing()
    exp_id = await ab.create_experiment(request.name, request.variants)
    return {"experiment_id": exp_id, "status": "draft"}

@router.post("/experiments/{exp_id}/start")
async def start_experiment(exp_id: str):
    """Start experiment"""
    ab = get_ab_testing()
    result = await ab.start_experiment(exp_id)
    return {"status": "running" if result else "not_found"}

@router.get("/experiments/{exp_id}/variant")
async def get_variant(exp_id: str, user_id: str):
    """Get variant for user"""
    ab = get_ab_testing()
    variant = await ab.get_variant(exp_id, user_id)
    
    if not variant:
        raise HTTPException(status_code=404, message="Experiment not found or not running")
    
    return {"variant": variant}

@router.post("/experiments/{exp_id}/convert")
async def record_conversion(exp_id: str, user_id: str, metric: str, value: float = 1.0):
    """Record conversion"""
    ab = get_ab_testing()
    result = await ab.record_conversion(exp_id, user_id, metric, value)
    return {"status": "recorded" if result else "failed"}

@router.get("/experiments/{exp_id}/results")
async def get_experiment_results(exp_id: str):
    """Get experiment results"""
    ab = get_ab_testing()
    results = ab.get_results(exp_id)
    return results

@router.get("/experiments")
async def list_experiments():
    """List experiments"""
    ab = get_ab_testing()
    return {"experiments": list(ab._experiments.keys())}

# ==================== Search ====================

class IndexRequest(BaseModel):
    doc_id: str
    document: dict

class SearchRequest(BaseModel):
    query: str
    filters: dict = {}
    limit: int = 10

def get_search_engine():
    from app.services.search_engine import get_search_engine
    return get_search_engine()

@router.post("/search/index")
async def index_content(request: IndexRequest):
    """Index content for search"""
    search = get_search_engine()
    await search.index(request.doc_id, request.document)
    return {"status": "indexed"}

@router.get("/search")
async def search(query: str, filters: str = None, limit: int = 10):
    """Search content"""
    search = get_search_engine()
    
    filter_dict = {}
    if filters:
        import json
        try:
            filter_dict = json.loads(filters)
        except:
            pass
    
    results = await search.query(query, filter_dict, limit)
    return {"data": results, "count": len(results)}

@router.get("/search/autocomplete")
async def autocomplete(prefix: str, limit: int = 5):
    """Autocomplete suggestions"""
    search = get_search_engine()
    suggestions = await search.autocomplete(prefix, limit)
    return {"data": suggestions}

@router.get("/search/analytics")
async def search_analytics():
    """Get search analytics"""
    search = get_search_engine()
    return search.get_analytics()

# ==================== Recommendation ====================

class UpdatePreferencesRequest(BaseModel):
    watched_videos: List[str] = []
    liked_videos: List[str] = []

def get_recommendation_engine():
    from app.services.recommendation_engine import get_recommendation_engine
    return get_recommendation_engine()

@router.get("/recommendations")
async def get_recommendations(
    user_id: int,
    niche: str = None,
    current_video: str = None,
    limit: int = 10
):
    """Get personalized recommendations"""
    rec = get_recommendation_engine()
    
    context = {}
    if niche:
        context["niche"] = niche
    if current_video:
        context["current_video"] = current_video
    
    recommendations = await rec.get_recommendations(user_id, context, limit)
    return {"data": recommendations}

@router.post("/recommendations/preferences")
async def update_preferences(user_id: int, request: UpdatePreferencesRequest):
    """Update user preferences"""
    rec = get_recommendation_engine()
    await rec.update_preferences(user_id, request.watched_videos, request.liked_videos)
    return {"status": "updated"}

@router.get("/recommendations/similar/{video_id}")
async def get_similar(video_id: str, limit: int = 5):
    """Get similar content"""
    rec = get_recommendation_engine()
    similar = await rec.get_similar_content(video_id, limit)
    return {"data": similar}

@router.get("/recommendations/trending")
async def get_trending(timeframe: str = "24h", limit: int = 10):
    """Get trending content"""
    rec = get_recommendation_engine()
    trending = await rec.get_trending(timeframe, limit)
    return {"data": trending}

@router.get("/recommendations/popular/{niche}")
async def get_popular(niche: str, limit: int = 10):
    """Get popular in niche"""
    rec = get_recommendation_engine()
    popular = await rec.get_popular_in_niche(niche, limit)
    return {"data": popular}

@router.get("/recommendations/stats/{user_id}")
async def get_user_stats(user_id: int):
    """Get user recommendation stats"""
    rec = get_recommendation_engine()
    stats = rec.get_user_stats(user_id)
    return stats