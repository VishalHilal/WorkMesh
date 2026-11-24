import logging

import uvicorn

from app.main import app

logger = logging.getLogger(__name__)

# Mount Gradio if available (standard in Hugging Face Gradio Spaces)
try:
    import gradio as gr

    with gr.Blocks(title="WorkMesh AI Service") as demo:
        gr.Markdown(
            "# 🧠 WorkMesh AI Service\n\n"
            "FastAPI backend running for WorkMesh.\n\n"
            "- **Status**: Active\n"
            "- **Health**: `/api/v1/health`\n"
            "- **Chat**: `/api/v1/chat`\n"
            "- **Retrieve**: `/api/v1/retrieve`\n"
            "- **Ingest**: `/api/v1/ingest`\n"
        )

    app = gr.mount_gradio_app(app, demo, path="/")
except ImportError:
    logger.info("Gradio not installed; serving FastAPI directly.")

if __name__ == "__main__":
    # Hugging Face Spaces listens on port 7860
    uvicorn.run(app, host="0.0.0.0", port=7860)
