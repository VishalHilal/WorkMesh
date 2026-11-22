from pydantic import BaseModel


class ServiceStatus(BaseModel):
    database: str


class HealthData(BaseModel):
    status: str
    version: str
    services: ServiceStatus


class MetaInfo(BaseModel):
    timestamp: str


class HealthResponse(BaseModel):
    data: HealthData
    meta: MetaInfo
