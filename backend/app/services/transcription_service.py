# app/services/transcription_service.py

from typing import AsyncIterator, Tuple

from google.cloud import speech_v1p1beta1 as speech

from app.core.config import settings


class TranscriptionService:
    """
    Wrapper around Google Cloud Speech-to-Text streaming API.

    Usage:
      async for transcript, is_final in service.stream_transcription(audio_chunks):
          ...
    """

    def __init__(self) -> None:
        # Use the async client so everything stays async-friendly
        self.client = speech.SpeechAsyncClient()

    def _build_config(self) -> speech.RecognitionConfig:
        return speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=settings.google_speech_sample_rate_hz,
            language_code=settings.google_speech_language_code,
            enable_automatic_punctuation=True,
            model="latest_long",
        )

    async def stream_transcription(
        self,
        audio_chunks: AsyncIterator[bytes],
    ) -> AsyncIterator[Tuple[str, bool]]:
        """
        :param audio_chunks: async iterator yielding raw audio bytes
        :return: async iterator yielding (transcript, is_final)
        """
        config = self._build_config()
        streaming_config = speech.StreamingRecognitionConfig(
            config=config,
            interim_results=True,
            single_utterance=False,
        )

        async def request_generator():
            # First message: config
            yield speech.StreamingRecognizeRequest(
                streaming_config=streaming_config
            )
            # Then stream audio
            async for chunk in audio_chunks:
                if not chunk:
                    continue
                yield speech.StreamingRecognizeRequest(audio_content=chunk)

        # streaming_recognize returns an async iterator of responses
        responses = await self.client.streaming_recognize(
            requests=request_generator()
        )

        async for response in responses:
            for result in response.results:
                if not result.alternatives:
                    continue
                transcript = result.alternatives[0].transcript
                is_final = result.is_final
                yield transcript, is_final
