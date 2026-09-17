// 기능: F-SES-08
import type { FastifyInstance } from 'fastify';

import { env } from '../env.js';

/**
 * 계정 삭제 안내 — 로그인 없이 열리는 웹 페이지 (F-SES-08).
 *
 * 왜 웹에 있나: 스토어 정책이 **앱을 이미 지운 사람도** 삭제를 요청할 수 있어야 한다고 본다.
 * 앱 안의 버튼만으로는 그 사람에게 길이 없다. 이 주소를 데이터 보안 양식에 적는다.
 *
 * 왜 여기서 바로 못 지우나: 웹에서 지우려면 카카오 로그인을 웹에도 붙여야 하고,
 * 그러면 화면 하나가 아니라 흐름 하나가 된다 (MVP 범위 밖). 정책은 「삭제 **또는 요청**」을
 * 허용하므로 요청 경로를 연다.
 *
 * ⚠️ 이 페이지의 「무엇이 지워지고 무엇이 남나」는 **개인정보처리방침·앱의 확인 문구와 같아야 한다.**
 * 셋이 다른 말을 하면 심사에서 걸린다. 고칠 때 셋을 같이 고친다.
 */
export async function accountRoutes(app: FastifyInstance) {
  app.get('/account/delete', async (_request, reply) => {
    return reply.type('text/html; charset=utf-8').send(PAGE);
  });
}

/**
 * 앱을 이미 지운 사람을 위한 문단. 주소를 안 넣었으면 통째로 빼고 재설치 안내만 남긴다 —
 * 닿지 않는 메일 주소를 보여주는 것보다 없는 게 낫다 (env.supportEmail 주석 참조).
 */
const contactBlock = env.supportEmail
  ? `앱을 다시 설치해 위 순서대로 하시는 게 가장 빨라요. 그게 어려우시면
       <a href="mailto:${env.supportEmail}">${env.supportEmail}</a> 로
       <b>가입에 쓰신 카카오 계정</b>을 알려주시면 저희가 지워드려요.`
  : `앱을 다시 설치해 위 순서대로 하시면 지울 수 있어요.`;

const PAGE = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>달살림 · 계정 삭제</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0 auto; padding: 32px 20px 64px; max-width: 640px;
    font-family: -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif;
    font-size: 16px; line-height: 1.7; color: #1B1D26; background: #F4F5FA;
  }
  h1 { font-size: 24px; margin: 0 0 4px; }
  h2 { font-size: 18px; margin: 32px 0 8px; }
  p, li { margin: 0 0 8px; }
  ol, ul { padding-left: 20px; }
  .lead { color: #5C6175; margin-bottom: 24px; }
  .card { background: #fff; border: 1px solid #E1E3EC; border-radius: 12px; padding: 16px 20px; }
  table { border-collapse: collapse; width: 100%; margin-top: 8px; }
  th, td { text-align: left; padding: 8px 10px; border-top: 1px solid #E1E3EC; vertical-align: top; }
  th { width: 44%; font-weight: 600; }
  thead th { border-top: 0; color: #5C6175; font-size: 14px; }
  .note { color: #5C6175; font-size: 14px; }
  a { color: #3A47A8; }
  @media (prefers-color-scheme: dark) {
    body { color: #EDEEF4; background: #14151B; }
    .card { background: #1D1F28; border-color: #2A2D39; }
    .lead, .note, thead th { color: #A4A9BD; }
    th, td { border-top-color: #2A2D39; }
    a { color: #C3CBFF; }
  }
</style>
</head>
<body>
  <h1>달살림 계정 삭제</h1>
  <p class="lead">계정을 지우는 방법과, 지운 뒤에 무엇이 남는지 알려드려요.</p>

  <h2>앱에서 지우기</h2>
  <div class="card">
    <ol>
      <li>달살림을 열고 <b>가족</b> 탭 오른쪽 위의 <b>내 정보</b>를 눌러요.</li>
      <li>맨 아래 <b>탈퇴하기</b>를 눌러요.</li>
      <li>확인 창에서 <b>탈퇴하기</b>를 한 번 더 누르면 끝이에요.</li>
    </ol>
    <p class="note">가족장이면 먼저 다른 구성원에게 가족장을 넘기거나, 혼자인 가족은 없앤 뒤에 탈퇴할 수 있어요.</p>
  </div>

  <h2>앱을 이미 지우셨다면</h2>
  <div class="card">
    <p>${contactBlock}</p>
  </div>

  <h2>무엇이 지워지고 무엇이 남나요</h2>
  <div class="card">
    <table>
      <thead><tr><th>항목</th><th>탈퇴하면</th></tr></thead>
      <tbody>
        <tr><th>카카오 계정 연결 · 닉네임 · 프로필 사진</th><td>지워져요</td></tr>
        <tr><th>알림을 보내기 위해 기기에 발급된 값</th><td>지워져요</td></tr>
        <tr><th>가족 구성원 자격</th><td>모든 가족에서 빠져요</td></tr>
        <tr>
          <th>가족 장부에 적은 기록<br /><span class="note">금액 · 항목 이름 · 사유 · 이번 달 특이사항</span></th>
          <td><b>한 번도 안 적으셨으면 같이 지워져요.</b> 적어두신 게 있으면 그 기록과
            거기 쓰신 글은 남아요 — 아래 설명을 봐주세요</td>
        </tr>
        <tr><th>가족 안에서 쓰시던 표시 이름</th><td>기록이 남는 동안 그 가족에게는 같이 보여요</td></tr>
      </tbody>
    </table>
    <p class="note" style="margin-top:12px">
      가족 장부는 <b>여러 사람이 함께 보는 기록</b>이에요. 내가 적은 줄을 지우면
      같은 달을 보는 다른 가족의 합계까지 바뀌기 때문에, 이미 적어둔 기록은 그대로 두고
      계정만 지워요. 한 줄도 안 적으셨다면 바뀔 합계가 없으니 <b>남김없이 지워요.</b>
    </p>
    <p class="note">
      기록이 남는 경우, 카카오 연결과 닉네임은 지워지지만 그 가족의 장부에는
      <b>가족 안에서 쓰시던 표시 이름</b>과 그때 적으신 글이 그대로 보여요.
      그 가족 구성원이 아니면 볼 수 없어요.
    </p>
  </div>

  <h2>다시 쓰고 싶어지면</h2>
  <div class="card">
    <p>
      언제든 다시 로그인할 수 있어요. 다만 <b>처음 오신 분</b>으로 시작해요 —
      가족에 다시 들어가려면 초대코드를 받아 가족장의 승인을 받으셔야 해요.
    </p>
  </div>
</body>
</html>
`;
