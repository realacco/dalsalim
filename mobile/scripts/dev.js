#!/usr/bin/env node

/**
 * 개발 서버 실행 (npm run dev)
 *
 *  1) 붙어 있는 기기가 없으면 에뮬레이터를 띄운다
 *  2) adb reverse 로 두 포트를 이 PC 로 터널링한다
 *       8081 → Metro (앱 번들)
 *       4000 → 달살림 API 서버
 *     이 터널 덕분에 에뮬레이터 안에서도 http://localhost:4000 이 그대로 통한다.
 *  3) expo start 실행
 *
 * 옵션:
 *   npm run dev -- --no-emu    에뮬레이터 자동 실행 없이
 *   npm run dev -- --clear     Metro 캐시 초기화
 *   npm run dev -- --android   부팅 후 Expo Go 를 자동으로 연다
 */

const { spawn, spawnSync } = require('child_process');
const { ensureEmulator, connectedDevices } = require('./emulator');

const PORTS = [8081, 4000];

const argv = process.argv.slice(2);
const skipEmulator = argv.includes('--no-emu');
const expoArgs = argv.filter((arg) => arg !== '--no-emu');

function setupReverse() {
  const devices = connectedDevices() ?? [];

  if (devices.length === 0) {
    console.log('⚠️  연결된 기기가 없습니다. QR 코드로 붙어주세요.');
    console.log('   실기기라면 EXPO_PUBLIC_API_URL 로 이 PC 의 LAN IP 를 넘겨야 합니다.');
    return;
  }

  for (const serial of devices) {
    for (const port of PORTS) {
      const result = spawnSync('adb', ['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`], {
        encoding: 'utf8',
      });

      if (result.status === 0) {
        console.log(`✅ ${serial} → localhost:${port}`);
      } else {
        console.log(`⚠️  ${serial} ${port} 터널 실패: ${(result.stderr || '').trim()}`);
      }
    }
  }
}

/** API 서버가 떠 있는지 확인한다. 안 떠 있으면 앱이 아무것도 못 한다. */
async function checkApi() {
  try {
    const response = await fetch('http://localhost:4000/health', {
      signal: AbortSignal.timeout(1500),
    });
    const body = await response.json();
    console.log(
      `✅ API 서버 연결됨 (카카오 ${body.kakao ? '켜짐' : '꺼짐'} · 개발 로그인 ${body.devLogin ? '켜짐' : '꺼짐'})`,
    );
  } catch {
    console.log('');
    console.log('⚠️  API 서버(localhost:4000)가 꺼져 있습니다.');
    console.log('   다른 터미널에서 아래를 먼저 실행하세요:');
    console.log('');
    console.log('     cd ../server && npm run dev');
    console.log('');
  }
}

async function main() {
  if (!skipEmulator) ensureEmulator();

  setupReverse();
  await checkApi();

  const expo = spawn('npx', ['expo', 'start', ...expoArgs], {
    stdio: 'inherit',
    shell: true, // npx 는 Windows 에서 .cmd 라 shell 이 필요하다
  });

  expo.on('exit', (code) => process.exit(code ?? 0));
}

void main();
