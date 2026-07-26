import httpx
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/ddalkkak", tags=["ddalkkak"])
DDALKKAK_URL = "http://127.0.0.1:8100"

@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy_ddalkkak(request: Request, path: str):
    url = f"{DDALKKAK_URL}/{path}"
    if url.endswith("/"):
        url = url[:-1]
        
    headers = dict(request.headers)
    headers.pop("host", None)
    
    if request.method == "OPTIONS":
        from fastapi.responses import Response
        return Response(status_code=200, headers={"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "*", "Access-Control-Allow-Headers": "*"})

    print(f"PROXY REQ: {request.method} /{path}")
    try:
        client = httpx.AsyncClient()
        req = client.build_request(
            request.method,
            url,
            headers=headers,
            params=request.query_params,
            content=request.stream()
        )
        
        response = await client.send(req, stream=True)
        print(f"PROXY RES: {response.status_code}")
        return StreamingResponse(
            response.aiter_raw(),
            status_code=response.status_code,
            headers=dict(response.headers),
            background=response.aclose
        )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Ddalkkak backend is unreachable: {exc}")

direct_router = APIRouter(tags=["ddalkkak_direct"])

DDALKKAK_PATHS = [
    "subtitle", "mascot", "mascots", "jobs", "remix", "candidates", 
    "dissections", "channels", "shorts", "audio-subtitle", "japanese", "clip-edit",
    "dissect", "pool", "cost-summary", "comfy", "fal", "kie", "admin", "assignments", "cache",
    "users", "auth", "discover", "quick-add", "tts-dub"
]

def make_proxy_route(p):
    @direct_router.api_route(f"/{p}/{{path:path}}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
    @direct_router.api_route(f"/{p}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
    async def proxy_ddalkkak_direct(request: Request, path: str = ""):
        url = f"{DDALKKAK_URL}/api/{p}/{path}" if path else f"{DDALKKAK_URL}/api/{p}"
        if url.endswith("/"):
            url = url[:-1]
            
        headers = dict(request.headers)
        headers.pop("host", None)
        
        if request.method == "OPTIONS":
            from fastapi.responses import Response
            return Response(status_code=200, headers={"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "*", "Access-Control-Allow-Headers": "*"})
    
        try:
            client = httpx.AsyncClient(timeout=120.0)
            req = client.build_request(
                request.method,
                url,
                headers=headers,
                params=request.query_params,
                content=request.stream()
            )
            
            response = await client.send(req, stream=True)
            return StreamingResponse(
                response.aiter_raw(),
                status_code=response.status_code,
                headers=dict(response.headers),
                background=response.aclose
            )
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"Ddalkkak API Unreachable: {exc}")

for p in DDALKKAK_PATHS:
    make_proxy_route(p)
