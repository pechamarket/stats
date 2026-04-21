/**
 * Google Apps Script Backend for Visitor Tracking
 * with Google Sheets Persistent Storage
 *
 * [설치 방법]
 * 1. script.google.com 에서 새 프로젝트 생성
 * 2. 아래 코드 전체를 붙여넣기
 * 3. SPREADSHEET_ID 에 본인의 구글 시트 ID 입력
 *    (구글 시트 URL에서 /d/ 뒤에 오는 긴 문자열이 ID입니다)
 * 4. 배포 > 새 배포 > 웹 앱 > 액세스: 모든 사용자 > 배포
 * 5. 생성된 웹 앱 URL을 대시보드(App.jsx)와 트래킹 스니펫에 붙여넣기
 *
 * [구글 시트 구조]
 * 시트 이름: "visitors"
 * 열: date | site | total
 */

// ✅ 아래에 본인의 구글 스프레드시트 ID를 입력하세요
var SPREADSHEET_ID = "11fi33j0r0-XaO1iYmQ8BAcjfVx5am3-G3gvp2n_1Mrs";

// 추적할 사이트 목록
var SITES = ["pecha.life", "119pecha.life", "pecha.shop", "pecha.cyou"];

// ─── 메인 핸들러 ───────────────────────────────────────────────
function doGet(e) {
  var params = e.parameter;

  // CORS 헤더 설정
  var output;

  if (params.action === "getStats") {
    output = ContentService.createTextOutput(
      JSON.stringify(getVisitorStats())
    ).setMimeType(ContentService.MimeType.JSON);
  } else if (params.site) {
    // 방문 핑 기록
    recordVisit(params.site);
    output = ContentService.createTextOutput("ok");
  } else {
    output = ContentService.createTextOutput("invalid request");
  }

  return output;
}

// ─── 방문 기록 ──────────────────────────────────────────────────
function recordVisit(site) {
  if (SITES.indexOf(site) === -1) return; // 허용된 사이트만 처리

  var cache = CacheService.getScriptCache();
  var timestamp = Math.floor(Date.now() / 1000);
  var today = getTodayKST();

  // 1. 실시간 핑 캐싱 (30초 유지)
  cache.put("ping_" + site + "_" + timestamp, "1", 30);

  // 2. 오늘 누적 카운트 캐시 업데이트
  var cacheKey = "total_" + site + "_" + today;
  var currentCached = parseInt(cache.get(cacheKey) || "0");
  cache.put(cacheKey, (currentCached + 1).toString(), 86400);

  // 3. 구글 시트에 영구 저장 (비동기처럼 빠르게 처리)
  try {
    saveToSheet(site, today);
  } catch (err) {
    // 시트 저장 실패해도 핑은 계속 동작
    Logger.log("Sheet save error: " + err.toString());
  }
}

// ─── 구글 시트 저장 ─────────────────────────────────────────────
function saveToSheet(site, today) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = getOrCreateSheet(ss, "visitors");

  // 헤더가 없으면 추가
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["date", "site", "total"]);
    sheet.getRange(1, 1, 1, 3).setFontWeight("bold");
  }

  // 오늘 날짜 + 사이트 행 검색
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === today && data[i][1] === site) {
      rowIndex = i + 1; // 1-indexed
      break;
    }
  }

  if (rowIndex === -1) {
    // 없으면 새 행 추가
    sheet.appendRow([today, site, 1]);
  } else {
    // 있으면 total 1 증가
    var cell = sheet.getRange(rowIndex, 3);
    cell.setValue((cell.getValue() || 0) + 1);
  }
}

// ─── 통계 조회 ──────────────────────────────────────────────────
function getVisitorStats() {
  var cache = CacheService.getScriptCache();
  var now = Math.floor(Date.now() / 1000);
  var today = getTodayKST();
  var stats = {};

  // 구글 시트에서 전체 데이터 가져오기 (오늘 + 전체 누적)
  var sheetTodayTotals = {};
  var sheetAllTimeTotals = {};

  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName("visitors");
    if (sheet && sheet.getLastRow() > 1) {
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        var rowDate = data[i][0];
        var rowSite = data[i][1];
        var rowCount = parseInt(data[i][2]) || 0;

        // 전체 누적 합산
        sheetAllTimeTotals[rowSite] = (sheetAllTimeTotals[rowSite] || 0) + rowCount;

        // 오늘 누적
        if (rowDate === today) {
          sheetTodayTotals[rowSite] = rowCount;
        }
      }
    }
  } catch (err) {
    Logger.log("Sheet read error: " + err.toString());
  }

  SITES.forEach(function (site) {
    // 실시간 접속자: 최근 30초 핑 카운트
    var liveCount = 0;
    for (var i = 0; i < 30; i++) {
      if (cache.get("ping_" + site + "_" + (now - i))) {
        liveCount++;
      }
    }

    // 결과 객체 구성
    stats[site] = {
      live: Math.min(liveCount, 999),
      today: sheetTodayTotals[site] !== undefined ? sheetTodayTotals[site] : parseInt(cache.get("total_" + site + "_" + today) || "0"),
      total: sheetAllTimeTotals[site] || 0
    };
  });

  return stats;
}

// ─── 유틸리티 ───────────────────────────────────────────────────

// KST(한국 시간) 기준 오늘 날짜 반환 (YYYY-MM-DD)
function getTodayKST() {
  var now = new Date();
  var kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split("T")[0];
}

// 시트가 없으면 생성
function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}
