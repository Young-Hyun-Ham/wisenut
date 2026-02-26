# URL 매핑 기반 Mock API 설계 제안서

## 목적
- 회사 내부 서버(`202.20.84.65`)에 접근 불가한 환경에서도 시나리오 실행 가능
- URL 단위로 응답을 모킹하여 실제 API 대신 로컬 JSON 응답 사용

## 핵심 아이디어
- 요청 URL을 키로 해서 mock 응답 파일을 찾는다.
- 매핑이 있으면 mock 응답을 반환하고, 없으면 에러(또는 선택적으로 실호출).

## 파일 구조 제안
```
data/
  mock_api/
    index.json
    responses/
      agt9001_checkBkgCntrSts.json
      agt9001_searchBkgInfo.json
      agt9001_searchCargoTrackingInfo.json
```

## index.json 예시
```json
{
  "http://202.20.84.65:8080/oceans/api/agt/agt9001/checkBkgCntrSts": "responses/agt9001_checkBkgCntrSts.json",
  "http://202.20.84.65:8080/oceans/api/agt/agt9001/searchBkgInfo": "responses/agt9001_searchBkgInfo.json",
  "http://202.20.84.65:8080/oceans/api/agt/agt9001/searchCargoTrackingInfo": "responses/agt9001_searchCargoTrackingInfo.json"
}
```

## 호출 흐름 (의사코드)
```python
def http_request(method, url, headers, body):
    if MOCK_MODE:
        mapping = load_index()
        if url not in mapping:
            return 503, {"error": "mock mapping not found", "url": url}
        return 200, load_json(mapping[url])
    # else: real request
```

## 설정 방식
- 환경변수 `MOCK_API=1` 활성화 시 mock 모드 동작
- `MOCK_INDEX_PATH`로 index.json 위치 변경 가능

## 에러 정책
- 매핑 없는 URL은 `503` 반환
- 추후 옵션으로 `ALLOW_REAL_API=1` 같은 스위치 추가 가능

## 장점
- URL 단위로 필요한 API만 빠르게 모킹 가능
- 시나리오별 응답 교체가 쉽다

## 주의사항
- `responseMapping` 경로와 동일한 JSON 구조로 응답을 구성해야 함
- 파일 경로는 반드시 상대 경로로 유지하여 환경 이동성 확보
