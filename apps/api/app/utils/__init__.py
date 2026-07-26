from fastapi import Request
from typing import Union

def get_web_url(request_or_base: Union[Request, str], file_path: str) -> str:
    """
    Converts a local file path to a web-accessible URL.
    Returns a domain-relative path to ensure compatibility across Docker and Browser.
    """
    if not file_path:
        return ""
        
    import urllib.parse
    encoded_path = urllib.parse.quote(file_path)
    
    # Return a relative path. The browser or client automatically prepends the correct host.
    # This solves the 'api:8000' leakage while maintaining inter-container accessibility.
    return f"/api/stream?path={encoded_path}"
