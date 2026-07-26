from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Any

class BinaryData(BaseModel):
    """
    Represents binary assets like videos, audio, or images inside a packet.
    """
    path: str
    mimetype: Optional[str] = None
    size: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)

class DataItem(BaseModel):
    """
    A single unit of data in a StandardDataPacket, which can contain both 
    structured JSON and associated binary files.
    """
    json_data: Dict[str, Any] = Field(default_factory=dict, alias="json")
    binary: Dict[str, BinaryData] = Field(default_factory=dict)

    class Config:
        populate_by_name = True
        alias_generator = None # Ensure it doesn't conflict with alias='json'

class StandardDataPacket(BaseModel):
    """
    The unified data exchange format for the Swarm Hub.
    All nodes should ideally return this to ensure interoperability.
    """
    items: List[DataItem] = Field(default_factory=list)

class QualityAuditPacket(BaseModel):
    """
    Standardized Inter-Agent Protocol (IAP) Packet for feedback loops.
    Returned by Critic agents to control the DAG node's internal state machine.
    """
    status: Literal["APPROVED", "REJECTED"] = Field(description="The verdict from the critic")
    feedback: List[str] = Field(default_factory=list, description="Specific feedback points if rejected")
    artifacts: Optional[dict] = Field(default=None, description="The resulting data if approved (pointers or raw payload)")
    retry_count: int = Field(default=0, description="Current number of retries")
