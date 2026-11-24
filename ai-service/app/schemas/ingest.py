from pydantic import BaseModel, Field


class IngestRequest(BaseModel):
    document_id: str = Field(..., description="Unique ID of the document in Node PostgreSQL")
    company_id: str = Field(..., description="Tenant company ID")
    storage_key: str = Field(..., description="S3 storage key in Neon Object Storage")
    file_name: str = Field(..., description="Original filename including extension")


class IngestData(BaseModel):
    document_id: str
    company_id: str
    chunk_count: int
    status: str


class IngestResponse(BaseModel):
    data: IngestData
    meta: dict[str, str]
