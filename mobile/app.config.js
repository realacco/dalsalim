// app.json 을 그대로 쓰되, 저장소에 둘 수 없는 것 하나만 여기서 얹는다.
//
// google-services.json (FCM · F-FAM-10) 은 Firebase 프로젝트의 것이라 공개 저장소에 안 올린다.
//   - 로컬: mobile/google-services.json 에 두면 그대로 잡힌다 (.gitignore 대상)
//   - EAS: 파일 환경변수 GOOGLE_SERVICES_JSON 으로 올리면 빌드 때 그 경로가 들어온다
// 둘 다 없으면 이 칸을 비운다 — Expo Go 로 도는 개발 루프에는 필요 없다.
//
// ⚠️ app.json 의 notification.color 는 theme.ts 의 colors.primary 를 손으로 옮겨 적은 값이다.
// 네이티브 매니페스트라 TS 토큰을 못 읽어서 어쩔 수 없는데, 토큰을 바꾸면 알림 아이콘 색만
// 조용히 낡는다. 여기서 theme.ts 를 require 하면 한 곳이 되지만 config 가 TS 를 물어야 해서
// 지금은 두 곳으로 둔다 — primary 를 바꾸는 사람이 app.json 도 같이 보게 여기 적어둔다.
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
