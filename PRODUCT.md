# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React 19, TypeScript, Vite, Tailwind CSS v4, Node.js Express API, Python FastAPI (AI Service), PostgreSQL with pgvector (Neon), Neon Object Storage (S3-compatible).

## Users

Enterprise employees and administrators at WorkMesh Technologies Pvt. Ltd.:
1. **Employees:** Upload and query company knowledge, retrieve documents, and verify policies with cited AI answers.
2. **Managers:** Review department knowledge documents and team workflows.
3. **Admins & Super Admins:** Manage company employee directories, assign roles, configure ingestion pipelines, and audit security events.

## Product Purpose

WorkMesh AI is an enterprise productivity and organizational intelligence platform. It grounds AI agents strictly in proprietary company knowledge (PDF, DOCX, TXT) using vector embeddings and similarity search, eliminating hallucinations and ensuring tenant-partitioned data access.

## Positioning

Unlike generic consumer chatbots, WorkMesh AI provides guaranteed multi-tenant company isolation, verified source-cited document retrieval, and strict role-based access control directly linked to enterprise workforce governance.

## Operating Context

- Enterprise office environments, compliance audits, policy handbooks, and engineering documentation.
- High-frequency daily usage: fast document uploads, instant vector search, and administrative directory management.

## Capabilities and Constraints

- **Capabilities:** Authenticated multi-tenant sessions, document ingestion (PDF, Word, Text) up to 10MB, Neon Object Storage, 384-dimensional pgvector HNSW vector indexing, company-scoped user management.
- **Constraints:** Strict multi-tenant boundaries (`companyId` scoping), no public file access (presigned S3 download URLs only), role-gated deletion.

## Brand Commitments

- **Company:** WorkMesh Technologies Pvt. Ltd. (`workmesh-tech`).
- **Tone:** Authoritative, disciplined, productive, minimal, professional.
- **Visual Stance:** Zero decorative clutter, zero AI tropes (no emoji, no kicker labels, no generic card kits). High-density, utilitarian SaaS design.

## Product Principles

1. **Utility Over Decoration:** Every visual element delivers information or initiates an action.
2. **Deterministic Security:** Every document and user query is strictly scoped to the tenant company.
3. **Restraint & Polish:** Clean typography, authored SVG icons, consistent stroke weights, and fast load times.
