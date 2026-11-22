from pydantic import BaseModel


class HealthData(BaseModel):
    status: str
    version: str


class MetaInfo(BaseModel):
    timestamp: str


class HealthResponse(BaseModel):
    data: HealthData
    meta: MetaInfo
