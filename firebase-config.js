// ──────────────────────────────────────────────────────────
//  Firebase 설정
//  https://console.firebase.google.com 에서 프로젝트 생성 후
//  아래 7개 값을 교체하면 완성됩니다.
//
//  [순서]
//  1. Firebase 콘솔 → 새 프로젝트 만들기
//  2. 왼쪽 메뉴 → Realtime Database → 데이터베이스 만들기
//     (테스트 모드로 시작 → 나중에 규칙 수정)
//  3. 프로젝트 설정(톱니바퀴) → 앱 추가(</>) → 앱 등록
//  4. 아래에 표시되는 firebaseConfig 값 복사 후 붙여넣기
// ──────────────────────────────────────────────────────────

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getDatabase }   from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

const firebaseConfig = {
    apiKey:            "AIzaSyCVOt1AV72d2CG0nB3zVadCk1nYyPxx-Sc",
    authDomain:        "everyclick-1f3cd.firebaseapp.com",
    databaseURL:       "https://everyclick-1f3cd-default-rtdb.firebaseio.com",
    projectId:         "everyclick-1f3cd",
    storageBucket:     "everyclick-1f3cd.firebasestorage.app",
    messagingSenderId: "797374981191",
    appId:             "1:797374981191:web:58e98b41e15f40ef22fd62",
    measurementId:     "G-FPZPD67SXP"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
