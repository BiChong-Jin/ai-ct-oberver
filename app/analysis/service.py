import base64
from io import BytesIO
from pathlib import Path

import anthropic
from PIL import Image

from app.config import ANTHROPIC_API_KEY, SUPPORTED_EXTENSIONS, MAX_FILE_SIZE

CT_ANALYSIS_PROMPT = """あなたはCT（コンピュータ断層撮影）スキャン画像を分析しています。以下の項目について詳細な分析を日本語で提供してください：

1. **画質評価**: 画像の品質、視認性、アーティファクトについてコメントしてください。

2. **解剖学的所見**: 確認できる解剖学的構造とその外観を説明してください。

3. **注目すべき所見**: 確認できる異常、病変、または懸念される領域を特定してください。

4. **技術的詳細**: 特定可能な場合、スキャンの種類、方向、造影剤の使用について記載してください。

5. **まとめ**: 観察結果の簡潔なまとめを提供してください。

重要な免責事項：この分析はAIによって教育・研究目的のみで生成されています。
これは医療診断ではなく、医療上の決定の根拠として使用すべきではありません。
医療画像の適切な解釈については、必ず資格を持つ放射線科医および医療専門家にご相談ください。"""

MEDIA_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
}


def get_media_type(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    return MEDIA_TYPES.get(ext, "image/jpeg")


def validate_file(filename: str, file_size: int, file_content: bytes) -> tuple[bool, str]:
    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        return False, f"Unsupported file type. Allowed: {', '.join(SUPPORTED_EXTENSIONS)}"

    if file_size > MAX_FILE_SIZE:
        return False, f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)} MB"

    try:
        img = Image.open(BytesIO(file_content))
        img.verify()
    except Exception:
        return False, "Invalid image file"

    return True, ""


def analyze_ct_image(file_content: bytes, filename: str) -> str:
    if not ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY not configured")

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    image_data = base64.standard_b64encode(file_content).decode("utf-8")
    media_type = get_media_type(filename)

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_data,
                        },
                    },
                    {
                        "type": "text",
                        "text": CT_ANALYSIS_PROMPT,
                    },
                ],
            }
        ],
    )

    return message.content[0].text
