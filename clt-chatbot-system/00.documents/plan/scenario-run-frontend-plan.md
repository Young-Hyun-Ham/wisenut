# 시나리오 구동 프론트 개선 계획서

## 목적
- 운영환경 데이터에 맞춘 `mock.py` 기준으로 시나리오가 정상 실행되도록 프론트 로직을 단순화한다.
- 숏컷 목록(`/shortcuts`)과 시나리오 목록(`/scenarios`) 간 불일치로 발생하는 실행 실패를 해소한다.

## 현상 요약
- 숏컷 데이터는 `/shortcuts`에서 내려오며 `subCategories.items.action.value`로 시나리오를 참조한다.
- 시나리오 목록은 `/scenarios`에서 내려오며 `items[].id`가 실행 ID다.
- 현재 프론트는 `/shortcuts` 응답을 `cat.items`로만 파싱해 `availableScenarios`가 비거나 불일치가 발생한다.
- 결과적으로 `availableScenarios.includes(scenarioId)` 체크에서 실패하여 토스트가 뜬다.

## 방향성
- item.action[type=scenario].value 를 시나리오 실행의 선택기준으로 확정한다.
- 서버의 데이터는 현재 기준으로 변경하지 않는다.
[현재 숏컷 데이터]
```json
[
    {
        "name": "Execution",
        "subCategories": [
            {
                "title": "Vessel Voyage Change",
                "items": [
                    {
                        "title": "Scenario #1-1",
                        "description": "선박 변경 안되는 케이스 Validation (출항 후(VL))",
                        "action": {
                            "type": "scenario",
                            "value": "선박 변경 안되는 케이스 Validation (출항 후(VL))",
                        },
                    },
                    {
                        "title": "Scenario #1-2",
                        "description": "대화흐름 방식 + J/O 단건 (B/L Charge)",
                        "action": {
                            "type": "scenario",
                            "value": "T대화흐름 방식 + J/O 단건 (B/L Charge)",
                        },
                    },
                    {
                        "title": "Scenario #1-3",
                        "description": "단일흐름 방식 + J/O 단건 (TPL Creation)",
                        "action": {
                            "type": "scenario",
                            "value": "단일흐름 방식 | JO 단건 (TPL Creation)",
                        },
                    },
                    {
                        "title": "Scenario #1-4",
                        "description": "단일흐름 방식 + J/O 다건(RPA) (B/L Charge)",
                        "action": {
                            "type": "scenario",
                            "value": "단일흐름 방식 | JO 다건(RPA) (BL Charge)",
                        },
                    },
                ],
            },
            {
                "title": "Tracking",
                "items": [
                    {
                        "title": "Scenario #2",
                        "description": "도착일자 영향 분석",
                        "action": {
                            "type": "scenario",
                            "value": "도착일자 영향 분석",
                        },
                    }
                ],
            },
            {
                "title": "Finance",
                "items": [
                    {
                        "title": "Scenario #3",
                        "description": "Finance 영향도 분석",
                        "action": {
                            "type": "scenario",
                            "value": "Finance 영향도 분석",
                        },
                    }
                ],
            },
        ],
    },
]
```

[현재 시나리오 목록 데이터]
```json
[
    {
        "category": "테스트_1_1_1",
        "items": [
            {
                "id": "DEV_1000_3",
                "title": "단일흐름 방식 | JO 다건(RPA) (BL Charge)",
                "description": "PoC#1,2",
            },
            {
                "id": "DEV_1000_4",
                "title": "단일흐름 방식 | JO 단건 (TPL Creation)",
                "description": "PoC#1,2",
            },
            {
                "id": "DEV_1000_1",
                "title": "도착일자 영향 분석",
                "description": "PoC#3 Tracking",
            },
            {
                "id": "DEV_1000_2",
                "title": "선박 변경_1(삭제 X, 편집 X)",
                "description": "PoC#1 영향도 분석",
            },
            {
                "id": "DEV_1000_6",
                "title": "선박 변경 안되는 케이스 Validation (출항 후(VL))",
                "description": "PoC#1 영향도 분석",
            },
            {
                "id": "DEV_1000_7",
                "title": "Finance 영향도 분석",
                "description": "2025.11.07",
            },
            {
                "id": "DEV_1000_5",
                "title": "대화흐름 방식 | JO 단건 (BL Charge)",
                "description": "PoC#1,2",
            },
            {
                "id": "DEV_1000_8",
                "title": "선박 변경_5(삭제 X, 편집 X)",
                "description": "PoC#1,2",
            },
            {
                "id": "DEV_1000_9",
                "title": "선박 변경_6(삭제 X, 편집 X)",
                "description": "PoC#1,2",
            },
            {
                "id": "DEV_1000_10",
                "title": "선박 변경_4(삭제 X, 편집 X)",
                "description": "PoC#1,2",
            },
            {
                "id": "DEV_1000_11",
                "title": "새로운 통합 말풍선 테스트",
                "description": "test",
            },
            {"id": "DEV_1000_12", "title": "선박 변경", "description": "PoC#1,2"},
            {
                "id": "DEV_1000_13",
                "title": "선박 변경_3(삭제 X, 편집 X)",
                "description": "PoC#2 기본 vessel voyage, 다건 job order, b/l charge 프로세스(default 자동 채우기)",
            },
        ],
    }
]
```

## 세부계획
### 1) 데이터 흐름 정의
- `/shortcuts`: 숏컷 렌더링용 데이터(카테고리/아이템/액션)
- `/scenarios`: 시나리오 메타 목록(실행 가능한 ID/Title)
- 실행 기준: `item.action.value`(운영 데이터 유지), 프론트에서 **title → id lookup** 수행

### 2) 매핑 규칙
- `action.value`가 `/scenarios.items[].title` 과 일치하면 해당 /scenarios.items[].id를 이용하여 시나리오 실행
- 매핑 실패: 토스트 출력 + 로그 기록(불일치 원인 확인용)

### 3) 세부 규칙
- 숏컷 수신 시 `subCategories[].items[]`를 순회하며 `action.type === "scenario"`만 추출
- `action.value`는 공백/대소문자 변환 없이 **원문 그대로** 매칭(운영 데이터 보존)
- `/scenarios`는 `items[].{id,title}`만 사용하며, 추가 필드는 캐시에 넣지 않음
- 실행 전 검증 순서:
  1) `action.value` 존재 여부 확인
  2) `/scenarios.items[].title` 일치 여부 확인
  3) 매핑된 `id`로 실행 호출
- 토스트 메시지에는 `action.value`를 포함해 운영팀이 바로 비교할 수 있게 함
- 로그에는 `action.value`, 매칭 실패 이유(미존재/중복)와 `/scenarios` 로딩 상태를 남김

### 4) 캐시/상태 정리
- `/shortcuts`와 `/scenarios`는 React Query로 조회하고 5분 캐시 유지
- Zustand에는 `scenarioCategories`, `availableScenarios`를 저장하지 않고 UI 상태만 유지
- 시나리오 실행 전 최신 `/scenarios` 캐시가 없으면 즉시 갱신 후 실행

### 5) 적용 순서
1) `/shortcuts` 파싱 로직 정리(중첩 구조 순회)
2) `/scenarios` 캐시 조회/갱신 로직 추가
3) 매핑/검증 함수 분리(순수 함수로 유지)
4) 실행 호출부에서 매핑 함수 적용
5) QA: 숏컷별 시나리오 실행 확인

### 6) 테스트 체크리스트
- `Scenario #1-1` 실행 시 `/scenarios`에서 title 매칭 → id 변환 확인
- `action.value`가 공백/특수문자를 포함해도 매칭되는지 확인
- `/scenarios` 캐시 미존재 상태에서 실행 시 정상 갱신되는지 확인
- 매핑 실패 시 토스트/로그가 원하는 형태로 출력되는지 확인
