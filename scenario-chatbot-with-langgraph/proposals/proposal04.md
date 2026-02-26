# 제안서: scenario01 폼 노드 처리 전략

## 분석 요약
scenario01_graph.txt 내 form 노드는 8개이며, 요소 타입은 `input`, `date`, `grid`로 구성됨.

### 폼 목록
- `form-1760610678381-2m7z8g0` (VVD Inquiry): input 3개, date 1개
- `form-1760613232028-ycfn6i1` (Roll Over Information): input 1개
- `form-1761012980853-7p8hjsx` (VVD Info): grid 1개
- `form-1761094139307-zo8hr98` (Job Order Elements): input 14개
- `form-1761099838690-9hxe3na` (E-Mail Job Order): input 2개
- `form-1761100118123-wtsng1j` (E-Mail TPL_Creation): input 2개
- `form-1761119972962-rmboqwu` (Booking No. 또는 Container No.를 입력해 주세요.): input 1개
- `form-1761120472751-dexjk3t` (변경 할 Vessel Voyage 정보를 입력해 주세요.): input 1개

## 처리 원칙 제안
1) form 노드 진입 시 `interrupt`로 입력 스키마를 전달  
2) 클라이언트는 스키마대로 UI를 구성  
3) 사용자가 입력하면 `user_action`에 `{field_name: value}` 형태로 전송  
4) 서버는 `Command(resume=user_action)`로 재개

## 스키마 구성 규칙
- form data
  - `title`: 안내 문구
  - `elements`: 입력 필드 정의
- element mapping
  - `type == "input"`: 텍스트 입력
  - `type == "date"`: 날짜 입력
  - `type == "grid"`: 읽기 전용 테이블(표시 전용)
- 필드 키는 `name`을 기본 키로 사용
- `defaultValue`가 있으면 UI 기본값으로 사용
- `validation.type`이 있으면 클라이언트에서 기본 검증 적용

## element별 입력 형태 예시
- input
  - UI: 단일 텍스트 입력
  - 값: string
- date
  - UI: 날짜 선택
  - 값: `YYYY-MM-DD` 권장
- grid
  - UI: 표 형태 표시(입력 불가)
  - 값: 없음 (user_action에서 제외)

## 예시 payload (interrupt)
```
{
  "type": "form",
  "node_id": "form-1761119972962-rmboqwu",
  "data": {
    "title": "Booking No. 또는 Container No.를 입력해 주세요.",
    "elements": [
      {
        "name": "number",
        "type": "input",
        "label": "Number",
        "placeholder": "Number",
        "defaultValue": "AL0000184940",
        "validation": {"type": "text"}
      }
    ]
  }
}
```

## 예시 payload (resume)
```
{
  "conversation_id": "conv-01",
  "user_input": "hi",
  "user_action": {
    "number": "AL0000184940"
  }
}
```

## 예시 payload (interrupt: form-1761094139307-zo8hr98)
```
{
  "type": "form",
  "node_id": "form-1761094139307-zo8hr98",
  "data": {
    "title": "Job Order Elements",
    "elements": [
      {"name":"eqNr","type":"input","label":"Container No.","placeholder":"Container No.","defaultValue":"{{contNr}}","validation":{"type":"text"}},
      {"name":"oprContQty","type":"input","label":"Quantity","placeholder":"Quantity","defaultValue":"{{oprContQty}}","validation":{"type":"text"}},
      {"name":"rcvTrmCd","type":"input","label":"Service Type","placeholder":"Service Type","defaultValue":"{{rcvTrmCd}}","validation":{"type":"text"}},
      {"name":"transmode","type":"input","label":"Transmode","placeholder":"Transmode","defaultValue":"Trunk","validation":{"type":"text"}},
      {"name":"bound","type":"input","label":"Bound","placeholder":"Bound","defaultValue":"OUT","validation":{"type":"text"}},
      {"name":"sCustId","type":"input","label":"Customer Code","placeholder":"Customer Code","defaultValue":"{{sCustId}}","validation":{"type":"text"}},
      {"name":"reason","type":"input","label":"Reason","placeholder":"Reason","defaultValue":"TERMINAL SHUTTLE","validation":{"type":"text"}},
      {"name":"fmPolCd","type":"input","label":"From","placeholder":"From","defaultValue":"{{fmPolCd}}","validation":{"type":"text"}},
      {"name":"bkgPolFclCd","type":"input","label":"Terminal(From)","placeholder":"Terminal(From)","defaultValue":"{{bkgPolFclCd}}","validation":{"type":"text"}},
      {"name":"polCdOld","type":"input","label":"To","placeholder":"To","defaultValue":"{{polCdOld}}","validation":{"type":"text"}},
      {"name":"terminal","type":"input","label":"Terminal(To)","placeholder":"Terminal(To)","defaultValue":"{{terminal}}","validation":{"type":"text"}},
      {"name":"actlWt","type":"input","label":"Cargo weight(KGS)","placeholder":"Cargo weight","defaultValue":"{{actlWt}}","validation":{"type":"text"}},
      {"name":"cmdtyCd","type":"input","label":"Commodity Code","placeholder":"Commodity Code","defaultValue":"{{cmdtyCd}}","validation":{"type":"text"}},
      {"name":"eqTp","type":"input","label":"TP/SZ","placeholder":"TP/SZ","defaultValue":"D4","validation":{"type":"text"}}
    ]
  }
}
```

## 예시 payload (resume: form-1761094139307-zo8hr98)
```
{
  "conversation_id": "conv-01",
  "user_input": "hi",
  "user_action": {
    "eqNr": "CMAU1234567",
    "oprContQty": "1",
    "rcvTrmCd": "CY",
    "transmode": "Trunk",
    "bound": "OUT",
    "sCustId": "CUST001",
    "reason": "TERMINAL SHUTTLE",
    "fmPolCd": "KRPUS",
    "bkgPolFclCd": "PUS",
    "polCdOld": "CNSHA",
    "terminal": "SHA",
    "actlWt": "12000",
    "cmdtyCd": "FAK",
    "eqTp": "D4"
  }
}
```

## 보완 필요 사항
- `grid` 타입의 실제 컬럼/데이터 매핑 규칙 정의
- `dataSourceType` / `dataSource` 활용 방식 정의
- `validation` 타입 확장(필수/패턴/길이 등) 여부 결정
