import os
from functools import lru_cache

from openai import OpenAI

CHUTES_BASE_URL = "https://llm.chutes.ai/v1"


@lru_cache(maxsize=1)
def get_chutes_client() -> OpenAI:
    return OpenAI(
        api_key=os.environ["CHUTES_API_KEY"],
        base_url=CHUTES_BASE_URL,
    )
