# 로컬 Docker Compose 트래픽 가로채기(로깅) 방법

※ 이 레포지토리에서는 `01.workspaces/infra`에서 `docker compose`를 실행하며, `docker-compose.override.yml`이 존재해 mitmproxy를 앞단에 연결한다.

목표: 로컬 Docker Compose 환경에서 실제 서비스 트래픽의 요청/응답(헤더+바디)을 기록한다.
권장 도구: `mitmproxy` (컨테이너로 실행, 간단한 설정)

## 1) 구성 개요
클라이언트 -> mitmproxy -> backend
즉, 클라이언트(브라우저/프론트/테스트)가 직접 backend로 가지 않고, **mitmproxy를 통과**하도록 바꾼다.

## 2) docker-compose.yml 예시
아래처럼 `mitmproxy` 서비스를 추가하고, 프록시 포트를 노출한다.

```yaml
services:
  mitmproxy:
    image: mitmproxy/mitmproxy:10.1.5
    container_name: mitmproxy
    command: >
      mitmweb --web-host 0.0.0.0 --web-port 8081
              --listen-host 0.0.0.0 --listen-port 8080
              --set console_eventlog_verbosity=info
    ports:
      - "8080:8080"  # 프록시 포트
      - "8081:8081"  # 웹 UI
```

## 3) 트래픽을 프록시로 보내는 방법
아래 중 한 가지를 선택한다.

### A. 클라이언트에서 프록시 설정 (권장)
- 브라우저/프론트 앱/테스트 클라이언트가 `http://localhost:8080` 프록시를 사용하도록 설정
- 이 경우, backend는 수정하지 않음

### B. 프론트 도메인/포트를 프록시로 변경
- 예: 기존 `http://localhost:8000` 호출을 `http://localhost:8080`으로 변경
- mitmproxy가 `backend`로 전달하도록 설정(기본은 그대로 전달하지 않음)

## 4) backend로 프록시 패스 설정(필수)
mitmproxy는 기본적으로 "사람이 인터셉트"하는 프록시다. 자동 패스를 하려면
`--mode reverse:http://chatbot-backend:8000` 같은 **리버스 프록시 모드**를 사용한다.

예시:
```yaml
services:
  mitmproxy:
    image: mitmproxy/mitmproxy:10.1.5
    container_name: mitmproxy
    command: >
      mitmweb --web-host 0.0.0.0 --web-port 8081
              --listen-host 0.0.0.0 --listen-port 8080
              --mode reverse:http://chatbot-backend:8000
              --set console_eventlog_verbosity=info
    ports:
      - "8080:8080"
      - "8081:8081"
```

## 5) 사용 방법
1. `docker compose up -d` 로 서비스 기동
2. 브라우저에서 `http://localhost:8081` 접속
3. 프론트/클라이언트 요청을 `http://localhost:8080`으로 보내기
4. mitmweb 화면에서 요청/응답 확인

### 로그/운영 팁
- `docker compose logs -f mitmproxy`로 proxy 이벤트 확인
- `docker compose logs --tail 100 <서비스명>`을 조합하면 최근 트래픽을 빠르게 조사 가능
- `docker compose logs --since 5m chatbot-backend`처럼 `--since` 옵션으로 시간 범위를 제한하면 재현 시점을 좁힐 수 있음

## 6) HTTPS 주의사항
- HTTPS를 가로채려면 클라이언트에 mitmproxy CA 인증서를 설치해야 한다.
- 로컬 개발에선 보통 HTTP로 먼저 확인하는 편이 빠르다.

## 7) 제거 방법
mitmproxy 서비스만 compose에서 삭제하거나, 포트 변경 후 재기동하면 된다.
