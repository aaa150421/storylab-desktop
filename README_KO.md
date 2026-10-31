# 이야기공방 데스크톱

이 저장소는 이야기공방 원고 작성 앱과 Windows 설치형 앱을 포함합니다. 설치형 Windows 앱은 GitHub Releases의 electron-updater 메타데이터를 사용해 업데이트를 확인합니다.

## 개발 및 정적 검사

Node.js 22와 Python 3.12가 필요합니다.

```sh
npm ci
npm run test:static
npm start
```

Windows 설치 파일만 빌드하려면 `npm run dist:win`을 실행합니다.

## 다음 버전 준비와 배포

배포는 `npm run release`로 시작합니다. 스크립트는 `main` 브랜치가 원격과 동기화되어 있고 작업 트리가 깨끗한지 확인한 뒤, 다음 patch 버전을 보여 주고 확인을 요청합니다. 승인하면 package 파일의 버전을 올려 커밋하고 `main`에 푸시합니다.

GitHub Actions가 Windows 설치 파일을 빌드하고 검증한 뒤, GitHub Releases에 설치 파일과 `latest.yml`을 게시합니다. 빌드가 성공했는지 Actions와 해당 릴리스 페이지에서 확인합니다. 버전 태그는 릴리스 게시 과정에서 만들어집니다.

버전 태그를 직접 푸시해 배포할 수도 있지만, 일반 배포에는 `npm run release`를 사용해 package 버전과 태그를 일치시키세요. 이미 게시된 버전 번호는 재사용하지 않습니다.

## 자동 업데이트

자동 업데이트는 Windows 설치형 앱에서 지원합니다. 새 버전은 실행 후 약 8초 뒤 확인하고, 이후 6시간 간격으로 확인합니다. 설치 프로그램을 직접 내려받아 설치할 수도 있습니다.

## 백업

중요한 원고는 앱 설정에서 JSON 백업을 내보내 별도로 보관하세요. 백업 복원은 현재 작업 공간의 데이터를 교체합니다.