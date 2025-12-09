# app/api/routes/transcription.py

import json
import logging
from typing import AsyncIterator

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.transcription_service import TranscriptionService

router = APIRouter()
logger = logging.getLogger(__name__)

transcription_service = TranscriptionService()


async def _audio_chunks_from_websocket(ws: WebSocket) -> AsyncIterator[bytes]:
    """
    Async iterator that yields raw audio bytes from the WebSocket.

    Frontend must send binary messages with small audio chunks (e.g. LINEAR16 16kHz).
    Optionally, a text message "STOP" can end the stream.
    """
    try:
        while True:
            message = await ws.receive()
            if "bytes" in message and message["bytes"] is not None:
                # Binary audio from client
                yield message["bytes"]
            elif "text" in message and message["text"] == "STOP":
                # Optional explicit end-of-stream
                break
    except WebSocketDisconnect:
        logger.info("Transcription WebSocket disconnected (client).")


@router.websocket("/ws")
async def websocket_transcription(ws: WebSocket):
    """
    Central live transcription endpoint.

    - Client connects (ws://.../transcription/ws)
    - Sends binary audio chunks
    - Receives JSON like: { "transcript": "...", "is_final": true/false }
    """
    await ws.accept()
    logger.info("Client connected to /transcription/ws")

    try:
        async for transcript, is_final in transcription_service.stream_transcription(
            _audio_chunks_from_websocket(ws)
        ):
            payload = {
                "transcript": transcript,
                "is_final": is_final,
            }
            await ws.send_text(json.dumps(payload))

    except WebSocketDisconnect:
        logger.info("Client disconnected from /transcription/ws")
    except Exception as exc:
        logger.exception("Error in transcription WebSocket: %s", exc)
        await ws.close(code=1011, reason="Internal server error")
