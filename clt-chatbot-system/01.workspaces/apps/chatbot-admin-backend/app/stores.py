from datetime import datetime
from typing import Dict, List
from uuid import uuid4

from app.schemas import (
    NodeColorSettings,
    NodeTextColorSettings,
    NodeVisibilitySettings,
    Post,
    ScenarioCategory,
    ScenarioDetail,
    ScenarioSubCategory,
    ScenarioSummary,
    Settings,
    ApiTemplate,
    FormTemplate,
)

SCENARIOS: Dict[str, ScenarioDetail] = {}
TEMPLATES_API: Dict[str, ApiTemplate] = {}
TEMPLATES_FORM: Dict[str, FormTemplate] = {}
SCENARIO_CATEGORIES: List[ScenarioCategory] = []
GLOBAL_SETTINGS = Settings()
NODE_COLOR_SETTINGS = NodeColorSettings(colors={"default": "#EDEDED", "action": "#FFD54F"})
NODE_TEXT_COLOR_SETTINGS = NodeTextColorSettings(colors={"default": "#1F2933"})
NODE_VISIBILITY_SETTINGS = NodeVisibilitySettings(visibleNodeTypes=["start", "action", "response"])
POSTS: Dict[str, Post] = {}
FILES: Dict[str, Dict[str, str]] = {}


def _ensure_default_scenario() -> None:
    if SCENARIOS:
        return
    default_id = str(uuid4())
    SCENARIOS[default_id] = ScenarioDetail(
        id=default_id,
        title="기본 안내 시나리오",
        description="관리자 초기 템플릿",
        nodes=[
            {"id": "node-0", "type": "start", "label": "시작"},
            {"id": "node-1", "type": "message", "label": "환영 메시지"},
        ],
    )


def _ensure_default_templates() -> None:
    if TEMPLATES_API and TEMPLATES_FORM:
        return
    api_id = str(uuid4())
    form_id = str(uuid4())
    TEMPLATES_API[api_id] = ApiTemplate(
        id=api_id,
        name="API 요청 예제",
        template_type= "api",
        method="POST",
        url="/api/example",
        headers={},
        body={},
        response_mapping=[],
    )
    TEMPLATES_FORM[form_id] = FormTemplate(
        id=form_id,
        name="폼 기반 시나리오",
        template_type= "form",
        elements=[],
    )


def _ensure_default_categories() -> None:
    if SCENARIO_CATEGORIES:
        return
    SCENARIO_CATEGORIES.append(
        ScenarioCategory(
            id="cat-core",
            title="핵심 시나리오",
            subCategories=[
                ScenarioSubCategory(
                    id="sub-core",
                    title="기본",
                    items=[
                        ScenarioSummary(
                            id=list(SCENARIOS.keys())[0],
                            title="기본 안내 시나리오",
                            description="시작 안내 메시지",
                        )
                    ],
                )
            ],
        )
    )


def _ensure_default_posts() -> None:
    if POSTS:
        return
    post_id = str(uuid4())
    POSTS[post_id] = Post(
        id=post_id,
        author="system",
        authorId="admin",
        authorPhotoURL=None,
        text="운영 공지: 관리자 백엔드 초기화 완료",
        fileUrl=None,
        fileName=None,
        fileType=None,
        timestamp=f"{datetime.utcnow().isoformat()}Z",
    )


def ensure_defaults() -> None:
    _ensure_default_scenario()
    _ensure_default_templates()
    _ensure_default_categories()
    _ensure_default_posts()


ensure_defaults()
