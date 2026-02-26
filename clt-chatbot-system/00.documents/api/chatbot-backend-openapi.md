# chatbot-backend OpenAPI (Design First)

## 개요
- 목적: 제품화용 `chatbot-backend`의 설계 우선(OpenAPI 기반) 개발을 위한 스펙 초안
- 인증: 기본 Bearer JWT, PoC 단계 dev-login 유지
- 메인 채팅(LLM): `/api/chat` 단일 경로, 스트리밍(SSE) 지원
- 범위: **사용자/채팅/대화/시나리오 조회 중심** (관리 기능 제외)

## OpenAPI 스펙 (YAML)
```yaml
openapi: 3.0.3
info:
  title: Chatbot Backend API
  version: 0.1.0
  description: |
    제품화 대상 chatbot-backend API 설계 초안.
    - 인증: Bearer JWT
    - 메인 채팅(LLM): /api/chat (SSE 스트리밍 지원)
servers:
  - url: http://localhost:8000
    description: local
  - url: https://api.example.com
    description: production

tags:
  - name: Auth
  - name: Users
  - name: Conversations
  - name: Chat
  - name: Scenarios
  - name: ScenarioSessions
  - name: Favorites
  - name: Notifications
  - name: Settings
  - name: Search
  - name: DevBoard
  - name: System

security:
  - bearerAuth: []

paths:
  /health:
    get:
      tags: [System]
      summary: 헬스 체크
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    example: ok

  /auth/dev-login:
    get:
      tags: [Auth]
      summary: PoC 임시 로그인 (dev/qa 전용)
      description: ENABLE_DEV_LOGIN=true 환경에서만 허용
      parameters:
        - name: id
          in: query
          required: true
          schema:
            type: string
          description: 사용자 ID
      responses:
        "200":
          description: 임시 토큰 발급
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/TokenResponse"
        "400":
          description: 잘못된 요청
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "403":
          description: 사용 불가 환경
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"

  /users/me:
    get:
      tags: [Users]
      summary: 내 정보 조회
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/User"

  /conversations:
    get:
      tags: [Conversations]
      summary: 대화 목록 조회
      parameters:
        - name: offset
          in: query
          required: false
          schema:
            type: integer
            minimum: 0
            default: 0
        - name: limit
          in: query
          required: false
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 50
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Conversation"

    post:
      tags: [Conversations]
      summary: 대화 생성
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                title:
                  type: string
                  example: 새 대화
      responses:
        "201":
          description: 생성됨
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Conversation"

  /conversations/{conversationId}:
    get:
      tags: [Conversations]
      summary: 대화 상세 조회(메시지 포함)
      parameters:
        - name: conversationId
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ConversationDetail"
    patch:
      tags: [Conversations]
      summary: 대화 정보 수정(제목/핀)
      parameters:
        - name: conversationId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                title:
                  type: string
                is_pinned:
                  type: boolean
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Conversation"

    delete:
      tags: [Conversations]
      summary: 대화 삭제
      parameters:
        - name: conversationId
          in: path
          required: true
          schema:
            type: string
      responses:
        "204":
          description: 삭제됨

  /conversations/{conversationId}/messages:
    get:
      tags: [Conversations]
      summary: 메시지 목록 조회
      parameters:
        - name: conversationId
          in: path
          required: true
          schema:
            type: string
        - name: skip
          in: query
          required: false
          schema:
            type: integer
            minimum: 0
            default: 0
        - name: limit
          in: query
          required: false
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 15
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Message"
    post:
      tags: [Conversations]
      summary: 메시지 저장
      parameters:
        - name: conversationId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/MessageCreate"
      responses:
        "201":
          description: 생성됨
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Message"

  /conversations/{conversationId}/messages/{messageId}:
    patch:
      tags: [Conversations]
      summary: 메시지 업데이트(선택지/피드백)
      parameters:
        - name: conversationId
          in: path
          required: true
          schema:
            type: string
        - name: messageId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/MessageUpdate"
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Message"

  /api/chat:
    post:
      tags: [Chat]
      summary: 메인 채팅 처리 (LLM 전용)
      description: |
        - 일반 응답: application/json
        - 스트리밍 응답: text/event-stream (SSE)
        - 시나리오 처리: /scenario-sessions 기반
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ChatRequest"
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ChatResponse"
            text/event-stream:
              schema:
                type: string
                description: SSE 스트리밍 (event + data)
        "400":
          description: 잘못된 요청
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "503":
          description: LLM 서비스 장애
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"

  /scenarios:
    get:
      tags: [Scenarios]
      summary: 시나리오 카테고리 목록
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/ScenarioCategory"

  /scenarios/{scenarioId}:
    get:
      tags: [Scenarios]
      summary: 시나리오 상세 조회
      parameters:
        - name: scenarioId
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ScenarioDetail"

  /scenario-sessions:
    post:
      tags: [ScenarioSessions]
      summary: 시나리오 세션 생성
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ScenarioSessionCreate"
      responses:
        "201":
          description: 생성됨
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ScenarioSession"

  /scenario-sessions/{sessionId}:
    get:
      tags: [ScenarioSessions]
      summary: 시나리오 세션 조회
      parameters:
        - name: sessionId
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ScenarioSession"
    patch:
      tags: [ScenarioSessions]
      summary: 시나리오 세션 업데이트
      parameters:
        - name: sessionId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ScenarioSessionUpdate"
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ScenarioSession"

  /scenario-sessions/{sessionId}/events:
    post:
      tags: [ScenarioSessions]
      summary: 시나리오 진행 이벤트(폴링)
      description: |
        - 폴링 기반 진행(1차)
        - 향후 SSE/스트리밍 전환 가능
        - PoC 호환: camelCase 입력을 임시 지원 후 snake_case로 전환
      parameters:
        - name: sessionId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ScenarioEventRequest"
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ScenarioEventResponse"

  /scenario-sessions/{sessionId}/end:
    post:
      tags: [ScenarioSessions]
      summary: 시나리오 세션 종료
      parameters:
        - name: sessionId
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ScenarioSession"

  /conversations/{conversationId}/scenario-sessions:
    get:
      tags: [ScenarioSessions]
      summary: 대화별 시나리오 세션 목록
      parameters:
        - name: conversationId
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/ScenarioSession"

  /favorites:
    get:
      tags: [Favorites]
      summary: 즐겨찾기 목록
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Favorite"
    post:
      tags: [Favorites]
      summary: 즐겨찾기 추가
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/FavoriteCreate"
      responses:
        "201":
          description: 생성됨
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Favorite"

  /favorites/{favoriteId}:
    delete:
      tags: [Favorites]
      summary: 즐겨찾기 삭제
      parameters:
        - name: favoriteId
          in: path
          required: true
          schema:
            type: string
      responses:
        "204":
          description: 삭제됨

  /favorites/reorder:
    post:
      tags: [Favorites]
      summary: 즐겨찾기 순서 저장
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/FavoriteReorderRequest"
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  updated:
                    type: integer
                    example: 5

  /notifications:
    get:
      tags: [Notifications]
      summary: 알림 목록
      parameters:
        - name: read
          in: query
          required: false
          schema:
            type: boolean
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Notification"

  /notifications/{notificationId}:
    patch:
      tags: [Notifications]
      summary: 알림 읽음 처리
      parameters:
        - name: notificationId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/NotificationUpdate"
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Notification"
    delete:
      tags: [Notifications]
      summary: 알림 삭제
      parameters:
        - name: notificationId
          in: path
          required: true
          schema:
            type: string
      responses:
        "204":
          description: 삭제됨

  /notifications/read-all:
    post:
      tags: [Notifications]
      summary: 알림 전체 읽음 처리
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  updated:
                    type: integer
                    example: 3

  /settings/user:
    get:
      tags: [Settings]
      summary: 개인 설정 조회
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/UserSettings"
    put:
      tags: [Settings]
      summary: 개인 설정 저장
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/UserSettings"
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/UserSettings"

  /settings/global:
    get:
      tags: [Settings]
      summary: 글로벌 설정 조회
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/GlobalSettings"
    put:
      tags: [Settings]
      summary: 글로벌 설정 저장
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/GlobalSettings"
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/GlobalSettings"

  /search:
    get:
      tags: [Search]
      summary: 통합 검색
      parameters:
        - name: q
          in: query
          required: true
          schema:
            type: string
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/SearchResult"

  /dev-board:
    get:
      tags: [DevBoard]
      summary: DevBoard 조회
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/DevBoard"
    post:
      tags: [DevBoard]
      summary: DevBoard 메모 추가
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/DevBoardCreate"
      responses:
        "201":
          description: 생성됨
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/DevBoard"
    put:
      tags: [DevBoard]
      summary: DevBoard 저장
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/DevBoard"
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/DevBoard"
  /dev-board/{memoId}:
    delete:
      tags: [DevBoard]
      summary: DevBoard 메모 삭제
      parameters:
        - name: memoId
          in: path
          required: true
          schema:
            type: string
      responses:
        "204":
          description: 삭제됨

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    User:
      type: object
      properties:
        id:
          type: string
          example: jwjun
        name:
          type: string
          example: jwjun
        role:
          type: string
          example: user

    TokenResponse:
      type: object
      properties:
        user:
          $ref: "#/components/schemas/User"
        access_token:
          type: string
          example: eyJhbGciOi...
        expires_in:
          type: integer
          example: 3600

    Conversation:
      type: object
      properties:
        id:
          type: string
          example: conv_123
        title:
          type: string
          example: 신규 대화
        is_pinned:
          type: boolean
          example: false
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time
    ConversationDetail:
      type: object
      properties:
        id:
          type: string
          example: conv_123
        title:
          type: string
          example: 신규 대화
        is_pinned:
          type: boolean
          example: false
        messages:
          type: array
          items:
            $ref: "#/components/schemas/Message"

    Message:
      type: object
      properties:
        id:
          type: string
          example: msg_123
        conversation_id:
          type: string
          example: conv_123
        role:
          type: string
          enum: [user, assistant, system]
        content:
          type: string
        created_at:
          type: string
          format: date-time
    MessageCreate:
      type: object
      properties:
        role:
          type: string
          enum: [user, assistant, system]
        content:
          type: string
    MessageUpdate:
      type: object
      properties:
        selectedOption:
          type: string
        feedback:
          type: string
          example: like

    ChatRequest:
      type: object
      required: [message]
      properties:
        message:
          type: object
          properties:
            text:
              type: string
          required: [text]
        slots:
          type: object
          additionalProperties: true
        language:
          type: string
          example: ko
        llmProvider:
          type: string
          example: flowise
        flowiseApiUrl:
          type: string
          example: http://flowise.local/api/v1/prediction/uuid

    ChatResponse:
      oneOf:
        - $ref: "#/components/schemas/LlmResponse"
        - $ref: "#/components/schemas/ErrorResponse"

    ScenarioStartResponse:
      type: object
      properties:
        type:
          type: string
          example: scenario_start
        next_node:
          type: object
          additionalProperties: true
        scenario_state:
          type: object
          additionalProperties: true
        slots:
          type: object
          additionalProperties: true

    ScenarioEndResponse:
      type: object
      properties:
        type:
          type: string
          example: scenario_end
        message:
          type: string
        scenario_state:
          type: object
          nullable: true
        slots:
          type: object
          additionalProperties: true

    LlmResponse:
      type: object
      properties:
        type:
          type: string
          example: llm_response_with_slots
        message:
          type: string
        slots:
          type: object
          additionalProperties: true

    ErrorResponse:
      type: object
      properties:
        type:
          type: string
          example: error
        message:
          type: string

    ScenarioCategory:
      type: object
      properties:
        id:
          type: string
          example: sales
        title:
          type: string
          example: 영업
        subCategories:
          type: array
          items:
            $ref: "#/components/schemas/ScenarioSubCategory"

    ScenarioSubCategory:
      type: object
      properties:
        id:
          type: string
        title:
          type: string
        items:
          type: array
          items:
            $ref: "#/components/schemas/ScenarioSummary"

    ScenarioSummary:
      type: object
      properties:
        id:
          type: string
        title:
          type: string
        description:
          type: string

    ScenarioDetail:
      type: object
      properties:
        id:
          type: string
        title:
          type: string
        nodes:
          type: array
          items:
            type: object
            additionalProperties: true
    ScenarioSessionCreate:
      type: object
      properties:
        scenario_id:
          type: string
        conversation_id:
          type: string
        slots:
          type: object
          additionalProperties: true
    ScenarioSessionUpdate:
      type: object
      properties:
        state:
          type: object
          additionalProperties: true
        slots:
          type: object
          additionalProperties: true
        status:
          type: string
          example: in_progress
    ScenarioEventRequest:
      type: object
      properties:
        input_type:
          type: string
          example: button
        input_value:
          type: string
          nullable: true
        source_handle:
          type: string
          nullable: true
        scenario_state:
          type: object
          additionalProperties: true
        slots:
          type: object
          additionalProperties: true
        language:
          type: string
          example: ko
    ScenarioEventResponse:
      oneOf:
        - $ref: "#/components/schemas/ScenarioStartResponse"
        - $ref: "#/components/schemas/ScenarioStepResponse"
        - $ref: "#/components/schemas/ScenarioEndResponse"
    ScenarioStepResponse:
      type: object
      properties:
        type:
          type: string
          example: scenario
        next_node:
          type: object
          additionalProperties: true
        scenario_state:
          type: object
          additionalProperties: true
        slots:
          type: object
          additionalProperties: true
        events:
          type: array
          items:
            type: object
            additionalProperties: true

    ScenarioCompatibilityNote:
      type: object
      description: |
        PoC 호환 규칙(임시):
        - nextNode → next_node
        - scenarioState → scenario_state
        - scenarioSessionId → scenario_session_id
    ScenarioSession:
      type: object
      properties:
        id:
          type: string
        scenario_id:
          type: string
        conversation_id:
          type: string
        state:
          type: object
          additionalProperties: true
        slots:
          type: object
          additionalProperties: true
        status:
          type: string
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time
    Favorite:
      type: object
      properties:
        id:
          type: string
        type:
          type: string
          example: scenario
        target_id:
          type: string
        created_at:
          type: string
          format: date-time
    FavoriteCreate:
      type: object
      properties:
        type:
          type: string
          example: scenario
        target_id:
          type: string
    FavoriteReorderRequest:
      type: object
      properties:
        orders:
          type: array
          items:
            type: object
            properties:
              id:
                type: string
              order:
                type: integer
    Notification:
      type: object
      properties:
        id:
          type: string
        title:
          type: string
        message:
          type: string
        is_read:
          type: boolean
        created_at:
          type: string
          format: date-time
    NotificationUpdate:
      type: object
      properties:
        is_read:
          type: boolean
    UserSettings:
      type: object
      properties:
        theme:
          type: string
          example: light
        locale:
          type: string
          example: ko
        shortcuts:
          type: array
          items:
            type: string
        fontSize:
          type: string
          example: default
        hideCompletedScenarios:
          type: boolean
        hideDelayInHours:
          type: integer
        contentTruncateLimit:
          type: integer
        fontSizeDefault:
          type: string
        isDevMode:
          type: boolean
        sendTextShortcutImmediately:
          type: boolean
        useFastApi:
          type: boolean
    GlobalSettings:
      type: object
      properties:
        maxFavorites:
          type: integer
        dimUnfocusedPanels:
          type: boolean
        enableFavorites:
          type: boolean
        showHistoryOnGreeting:
          type: boolean
        mainInputPlaceholder:
          type: string
        headerTitle:
          type: string
        enableMainChatMarkdown:
          type: boolean
        showScenarioBubbles:
          type: boolean
        llmProvider:
          type: string
        flowiseApiUrl:
          type: string
    SearchResult:
      type: object
      properties:
        type:
          type: string
          example: conversation
        id:
          type: string
        title:
          type: string
        snippets:
          type: array
          items:
            type: string
    DevBoard:
      type: object
      properties:
        id:
          type: string
        content:
          type: string
        authorName:
          type: string
        authorUid:
          type: string
        created_at:
          type: string
          format: date-time
    DevBoardCreate:
      type: object
      properties:
        content:
          type: string
```
