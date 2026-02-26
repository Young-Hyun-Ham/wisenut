# 제안서: slot 상태를 Node State로 통합 (setSlot/message/api/branch)

## 배경 및 문제
- `scenario01.json`에 `setSlot` 노드가 다수 존재함
- 현재 슬롯 값이 노드 외부(전역/별도 저장)에서 관리될 가능성이 높아 보임
- 슬롯 상태가 그래프 실행 흐름과 분리되면 디버깅/재현성이 떨어짐
- 인터럽트/재개 시 슬롯 일관성 보장이 어려움

## 목표
- 슬롯 상태를 Node State에 포함하여 실행 흐름과 함께 저장/복원
- `setSlot` 노드가 상태 변경을 명확하게 남기도록 표준화
- 체크포인터와 연동되어 재개 시 동일한 슬롯 상태 보장

## 용어 정리
- `slot`: Key-Value 맵 형태의 대화 상태
- `state.slot`: 실행 중 유지되는 슬롯 맵

## 제안 설계
- Node State 구조에 `slot` 필드 추가
  - 예: `state = { ..., "slot": {"name": "홍길동", "age": 30} }`
- `setSlot` 노드 동작
  - 입력 데이터(템플릿 포함)로 슬롯 업데이트
  - 업데이트 전후 상태를 일관된 규칙으로 처리
- 표현식/템플릿에서 `state.slot`을 참조

## setSlot 상세 규칙(안)
- `data.slot`: 저장할 슬롯 키(단일 키, 중첩 키는 추후 확장)
- `data.value`: 템플릿 치환 후 최종 값으로 저장
- 기존 키가 있을 경우 덮어쓰기(명시적 merge/append는 추후 옵션)

## 적용 흐름
1) 그래프 실행 시 초기 `state.slot`을 빈 dict로 초기화
2) `setSlot` 노드에서 `state.slot[key] = value` 업데이트
3) 이후 노드에서 `state.slot` 값을 참조하여 분기/메시지 생성
4) 체크포인터로 `state` 전체 저장/복원

## form 노드 입력 처리 규칙
- form `interrupt`로 받은 사용자 입력을 `state.slot`에 병합
- 입력 키 이름과 동일한 슬롯 키로 저장
- 기존 슬롯 값이 있으면 덮어쓰기
- 예: `{ "number": "AL0000184940" }` 입력 -> `state.slot.number = "AL0000184940"`

## 메시지 노드 변수 치환 규칙
- message 노드의 `content`는 `{{변수}}` 형태의 더블 머스태시 템플릿을 포함할 수 있음
- 템플릿 치환 대상은 `state.slot`을 기본으로 하고, 필요 시 `state`의 다른 필드도 확장 가능
- 예: `안녕하세요 {{user_name}}님` -> `state.slot.user_name`로 치환
- 치환 실패 시 정책을 명시해야 함(빈 문자열/원문 유지/에러)

## 템플릿/표현식 규칙(안)
- 기본 컨텍스트는 `state.slot`
- 컨텍스트 확장 시 `state`의 다른 키를 명시적으로 허용
  - 예: `state.form_values`, `state.choice`
- 변수는 점 표기법만 지원(예: `{{user.name}}`), 배열 인덱스는 추후 확장
- 치환 값이 비문자열일 경우 `str()` 변환
- 치환 실패 정책: 기본은 빈 문자열, 필요 시 원문 유지/에러로 설정 가능

## API 응답의 슬롯 반영 규칙
- `application/json` 응답인 경우 `responseMapping`을 통해 응답 값을 `state.slot`에 저장
- `responseMapping` 항목은 `path`와 `slot`으로 구성
  - 예: `path: "result[0].bscAmt"` -> `slot: "bscAmt"`
  - 예: `path: "result[0].jiSpNm"` -> `slot: "jiSpNm"`
- `path`는 JSON 경로 유사 문법으로 응답 객체에서 값을 추출
- 매핑 실패 시 정책 명시 필요(미설정/기존 값 유지/에러)
- 참고 노드: `api-1761787525968-ugv3rbq`

## API 응답 매핑 규칙(안)
- 응답 `Content-Type`이 `application/json`일 때만 파싱
- `path`는 `a.b.c` 및 `a[0].b` 형태를 지원(배열 인덱스 포함)
- 추출 값이 객체/배열이면 그대로 `state.slot`에 저장
- 값 미존재 시 매핑 스킵(기본), 필요 시 기본값 옵션 추가

## 브랜치 노드 분기 규칙
- 모든 브랜치 노드는 `data.evaluationType == "CONDITION"`일 때 `data.conditions`를 평가 기준으로 사용
- `data.conditions`는 `state.slot`을 참조해 분기 방향을 결정하는 로직으로 간주
- 제안 방향
  - 조건식의 평가 대상은 기본적으로 `state.slot`로 고정
  - 조건식 실패 시 기본 경로(else) 정책을 정의
  - 조건식 표기 규칙을 문서화하여 시나리오 작성 일관성 확보
- 참고 노드: `branch-1761816299002-5pqh4qa`

## CONDITION 분기 규칙(안)
- 조건 항목 구조
  - `slot`: 비교 대상 키
  - `operator`: 비교 연산자(기본 `==`, 추가 연산자는 확장)
  - `value`: 비교 값
  - `id`: 조건 식별자
- 평가 규칙
  - `state.slot[slot]` 값을 가져와 비교
  - 기본 비교는 문자열 기준(필요 시 타입 캐스팅 정책 추가)
  - 첫 번째로 참인 조건의 경로로 분기
  - 모두 실패 시 기본 경로(else) 사용
- 경로 매핑
  - `conditions[].id`와 `edge.sourceHandle` 값을 일치시키는 규칙을 표준화
  - 필요 시 `conditions[].handle` 필드를 추가해 명시 매핑
- 연산자 범위
  - 기본: `==`, `contains`
  - 확장: `<`, `<=`, `>`, `>=`, `!=`, `in`, `exists`, `regex`
- 연산자 동작 정의(안)
  - `==`: 문자열 기준 동일 비교
  - `!=`: 문자열 기준 불일치 비교
  - `in`: `value`가 배열일 때 포함 여부(`slot` 값이 배열 요소로 존재)
  - `exists`: `slot` 값이 존재하고 빈 문자열이 아닐 때 참
  - `<`, `<=`, `>`, `>=`: 숫자 비교(비교 전 `float` 캐스팅 시도)
  - `contains`: `slot` 값이 문자열일 때 부분 문자열 포함 여부
  - `regex`: 정규식 매칭(기본 플래그 없음)

## 데이터 모델(예시)
- setSlot 노드 데이터
  - `{ "slot": "user_name", "value": "{{input.name}}" }`
- Node State
  - `{ "slot": { "user_name": "홍길동" } }`

## 기대 효과
- 슬롯 변경이 그래프 실행 맥락에 함께 저장됨
- 디버깅 시 상태 추적이 단순화됨
- 재시작/재개 시 슬롯 불일치 문제 감소

## 단계적 적용 계획
1) Node State에 `slot` 필드 추가 및 기본 초기화
2) `setSlot` 노드 처리 로직 구현
3) 슬롯 참조 방식 정리(템플릿/표현식 규칙)
4) scenario01 기반 테스트 및 회귀 확인

## 리스크 및 대응
- 기존 시나리오와의 호환성 이슈: 기본 `slot` 초기화로 방어
- 템플릿 평가 비용 증가: 필요 시 캐싱/간소화
