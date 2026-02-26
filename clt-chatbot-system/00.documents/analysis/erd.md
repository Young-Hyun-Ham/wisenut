# ERD 초안 (제품화용)

## 개요
현재 PoC 기능과 고객사 요구사항을 기준으로 도출한 ERD 초안이다. 실제 테이블/컬럼은 백엔드 설계 확정 시 조정 필요.

## Mermaid ERD
```mermaid
erDiagram
  user {
    uuid id PK
    string email
    string name
    string role
    string status
    datetime created_at
    datetime updated_at
  }

  scenario {
    uuid id PK
    string name
    string description
    string job
    string version
    string category_id
    jsonb nodes
    jsonb edges
    datetime created_at
    datetime updated_at
    datetime last_used_at
  }

  scenario_session {
    uuid id PK
    uuid scenario_id FK
    uuid user_id FK
    uuid conversation_id FK
    string status
    string current_node_id
    json slots
    json context
    datetime started_at
    datetime last_active_at
    datetime ended_at
  }

  conversation {
    uuid id PK
    uuid user_id FK
    string title
    boolean pinned
    datetime created_at
    datetime updated_at
  }

  message {
    uuid id PK
    uuid conversation_id FK
    uuid user_id FK
    string sender
    text content
    string type
    uuid scenario_session_id
    json meta
    datetime created_at
  }

  scenario_category {
    string id PK
    string name
    string parent_id
    int sort_order
  }

  shortcut {
    uuid id PK
    string title
    string action_type
    string action_value
    string category_id FK
    int sort_order
    boolean enabled
  }

  api_template {
    uuid id PK
    uuid owner_id FK
    string name
    string method
    string url
    json headers
    json body
    json response_mapping
    datetime created_at
    datetime updated_at
  }

  form_template {
    uuid id PK
    uuid owner_id FK
    string name
    json schema
    datetime created_at
    datetime updated_at
  }

  notification {
    uuid id PK
    uuid user_id FK
    string type
    text message
    boolean read
    datetime created_at
  }

  favorite {
    uuid id PK
    uuid user_id FK
    string target_type
    uuid target_id
    datetime created_at
  }

  user_setting {
    uuid user_id PK
    string theme
    string font_size
    json preferences
    datetime updated_at
  }

  dev_memo {
    uuid id PK
    uuid scenario_id FK
    uuid author_id FK
    text content
    datetime created_at
  }

  node_visibility_setting {
    uuid id PK
    uuid owner_id FK
    json visible_node_types
    datetime updated_at
  }

  user ||--o{ conversation : owns
  user ||--o{ scenario_session : starts
  user ||--o{ message : sends
  user ||--o{ notification : receives
  user ||--o{ favorite : saves
  user ||--o{ user_setting : configures
  user ||--o{ api_template : owns
  user ||--o{ form_template : owns
  user ||--o{ node_visibility_setting : owns

  conversation ||--o{ message : logs
  conversation ||--o{ scenario_session : contains

  scenario ||--o{ scenario_session : runs
  scenario ||--o{ dev_memo : notes

  scenario_session ||--o{ message : references

  scenario_category ||--o{ shortcut : groups
```

## 모델 설명 요약
- `CONVERSATION`: LLM/일반 대화 목록(대화방)
- `MESSAGE`: LLM 포함 전체 대화 메시지 로그 (scenario_session_id는 선택)
- `SCENARIO`: 그래프 정의 (nodes/edges를 jsonb 배열로 저장)
- `SCENARIO_SESSION`: 실행 상태, 슬롯/컨텍스트 저장 (서버 권한 소스)
- `SCENARIO_CATEGORY/SHORTCUT`: 시나리오 시작/메뉴 구조
- `API_TEMPLATE/FORM_TEMPLATE`: 관리자 템플릿 관리
- `NOTIFICATION/FAVORITE/USER_SETTING`: 사용자 편의 기능
- `DEV_MEMO/NODE_VISIBILITY_SETTING`: 관리자/개발 보조 기능

## 남은 결정 사항
- 세션/메시지 보관 기간 및 파티셔닝 정책
- 슬롯/컨텍스트 JSON 스키마 고정 여부
- 멀티 테넌트(tenant) 분리 방식
- 역할/권한 모델(관리자/운영자/사용자)
