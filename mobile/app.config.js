// app.json 을 그대로 쓰되, 저장소에 둘 수 없는 것 하나만 여기서 얹는다.
//
// google-services.json (FCM · F-FAM-10) 은 Firebase 프로젝트의 것이라 공개 저장소에 안 올린다.
//   - 로컬: mobile/google-services.json 에 두면 그대로 잡힌다 (.gitignore 대상)
//   - EAS: 파일 환경변수 GOOGLE_SERVICES_JSON 으로 올리면 빌드 때 그 경로가 들어온다
// 둘 다 없으면 이 칸을 비운다 — Expo Go 로 도는 개발 루프에는 필요 없다.
const fs = require('node:fs');

module.exports = ({ config }) => {
  const local = './google-services.json';
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ?? (fs.existsSync(local) ? local : undefined);

  return {
    ...config,
    android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) },
  };
};
