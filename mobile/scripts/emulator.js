#!/usr/bin/env node

/**
 * 안드로이드 에뮬레이터 실행 헬퍼 (npm run emu)
 *
 * 이 PC는 Android Studio 없이 SDK + JDK 만으로 돌린다.
 * AVD 를 만드는 방법은 DEV-SETUP.md 를 참고할 것.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const DEFAULT_AVD = 'dalsalim';

/** 이 PC 의 Android SDK 위치 */
function findSdk() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
    path.join(os.homedir(), 'Library', 'Android', 'sdk'),
    path.join(os.homedir(), 'Android', 'Sdk'),
  ];

  return candidates.find((dir) => dir && fs.existsSync(path.join(dir, 'emulator'))) ?? null;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** adb 에 붙어 있는 기기 시리얼 목록. adb 를 못 찾으면 null. */
function connectedDevices() {
  const result = spawnSync('adb', ['devices'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;

  return result.stdout
    .split('\n')
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter(([serial, state]) => serial && state === 'device')
    .map(([serial]) => serial);
}

function waitForBoot(timeoutMs = 240_000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const result = spawnSync('adb', ['shell', 'getprop', 'sys.boot_completed'], {
      encoding: 'utf8',
    });

    if ((result.stdout || '').trim() === '1') return true;
    sleep(2000);
  }

  return false;
}

/**
 * 기기가 하나도 없으면 에뮬레이터를 띄운다.
 *
 * ⚠️ GPU 는 swiftshader_indirect(소프트웨어 렌더러)로 고정한다.
 * 이 PC 에서 `auto` 로 두면 프레임버퍼가 멈춰 화면이 얼어붙는 문제가 있다.
 * (앱은 멀쩡히 돌아가는데 화면만 옛 프레임을 보여준다 — 디버깅할 때 크게 헷갈린다)
 */
function ensureEmulator(avdName = DEFAULT_AVD) {
  const devices = connectedDevices();

  if (devices === null) {
    console.log('⚠️  adb 를 찾지 못했습니다. Android SDK platform-tools 가 PATH 에 있는지 확인하세요.');
    return false;
  }

  if (devices.length > 0) {
    console.log(`✅ 기기 연결됨: ${devices.join(', ')}`);
    return true;
  }

  const sdk = findSdk();
  if (!sdk) {
    console.log('⚠️  Android SDK 를 찾지 못했습니다.');
    return false;
  }

  const avdHome = path.join(os.homedir(), '.android', 'avd');
  if (!fs.existsSync(path.join(avdHome, `${avdName}.ini`))) {
    console.log(`⚠️  '${avdName}' AVD 가 없습니다. DEV-SETUP.md 의 'AVD 만들기' 를 참고하세요.`);
    return false;
  }

  console.log(`🚀 에뮬레이터 '${avdName}' 부팅 중... (첫 부팅은 1~2분 걸립니다)`);

  const child = spawn(
    path.join(sdk, 'emulator', 'emulator'),
    ['-avd', avdName, '-no-boot-anim', '-gpu', 'swiftshader_indirect'],
    { detached: true, stdio: 'ignore' },
  );
  child.unref();

  if (!waitForBoot()) {
    console.log('⚠️  부팅을 기다리다 시간이 초과됐습니다. 에뮬레이터 창을 확인해주세요.');
    return false;
  }

  console.log('✅ 에뮬레이터 준비 완료');
  return true;
}

module.exports = { ensureEmulator, connectedDevices, findSdk };

if (require.main === module) {
  process.exit(ensureEmulator(process.argv[2] || DEFAULT_AVD) ? 0 : 1);
}
