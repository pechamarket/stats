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
  var hour = getHourKST();

  // 1. 실시간 핑 캐싱 (30초 유지)
  cache.put("ping_" + site + "_" + timestamp, "1", 30);

  // 2. 오늘 누적 카운트 캐시 업데이트
  var cacheKey = "total_" + site + "_" + today;
  var currentCached = parseInt(cache.get(cacheKey) || "0");
  cache.put(cacheKey, (currentCached + 1).toString(), 86400);

  // 3. 구글 시트에 영구 저장 (비동기처럼 빠르게 처리)
  try {
    saveToSheet(site, today, hour);
  } catch (err) {
    // 시트 저장 실패해도 핑은 계속 동작
    Logger.log("Sheet save error: " + err.toString());
  }
}

// ─── 구글 시트 저장 ─────────────────────────────────────────────
function saveToSheet(site, today, hour) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // A. 일일 합계 업데이트 (visitors 시트)
  var dailySheet = getOrCreateSheet(ss, "visitors");
  if (dailySheet.getLastRow() === 0) {
    dailySheet.appendRow(["date", "site", "total"]);
    dailySheet.getRange(1, 1, 1, 3).setFontWeight("bold");
  }

  var dailyData = dailySheet.getDataRange().getValues();
  var dailyRowIndex = -1;
  for (var i = 1; i < dailyData.length; i++) {
    if (dailyData[i][0] === today && dailyData[i][1] === site) {
      dailyRowIndex = i + 1;
      break;
    }
  }

  if (dailyRowIndex === -1) {
    dailySheet.appendRow([today, site, 1]);
  } else {
    var cell = dailySheet.getRange(dailyRowIndex, 3);
    cell.setValue((cell.getValue() || 0) + 1);
  }

  // B. 시간별 통계 업데이트 (hourly 시트)
  var hourlySheet = getOrCreateSheet(ss, "hourly");
  if (hourlySheet.getLastRow() === 0) {
    var header = ["date", "site"];
    for (var h = 0; h < 24; h++) header.push(h + "시");
    hourlySheet.appendRow(header);
    hourlySheet.getRange(1, 1, 1, 26).setFontWeight("bold");
  }

  var hourlyData = hourlySheet.getDataRange().getValues();
  var hourlyRowIndex = -1;
  for (var j = 1; j < hourlyData.length; j++) {
    if (hourlyData[j][0] === today && hourlyData[j][1] === site) {
      hourlyRowIndex = j + 1;
      break;
    }
  }

  if (hourlyRowIndex === -1) {
    var newRow = [today, site];
    for (var k = 0; k < 24; k++) newRow.push(k === hour ? 1 : 0);
    hourlySheet.appendRow(newRow);
  } else {
    var hourCell = hourlySheet.getRange(hourlyRowIndex, hour + 3); // date, site 가 1, 2열이므로 hour 0은 3열
    hourCell.setValue((hourCell.getValue() || 0) + 1);
  }
}

// ─── 통계 조회 ──────────────────────────────────────────────────
function getVisitorStats() {
  var cache = CacheService.getScriptCache();
  var now = Math.floor(Date.now() / 1000);
  var today = getTodayKST();
  var stats = {};

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // 1. 일일 데이터 가져오기
  var sheetTodayTotals = {};
  var sheetAllTimeTotals = {};
  try {
    var dailySheet = ss.getSheetByName("visitors");
    if (dailySheet && dailySheet.getLastRow() > 1) {
      var dailyData = dailySheet.getDataRange().getValues();
      for (var i = 1; i < dailyData.length; i++) {
        var rowDate = dailyData[i][0];
        var rowSite = dailyData[i][1];
        var rowCount = parseInt(dailyData[i][2]) || 0;
        sheetAllTimeTotals[rowSite] = (sheetAllTimeTotals[rowSite] || 0) + rowCount;
        if (rowDate === today) sheetTodayTotals[rowSite] = rowCount;
      }
    }
  } catch (e) {}

  // 2. 시간별 데이터 가져오기 (오늘 기준)
  var hourlyStats = {};
  try {
    var hourlySheet = ss.getSheetByName("hourly");
    if (hourlySheet && hourlySheet.getLastRow() > 1) {
      var hourlyData = hourlySheet.getDataRange().getValues();
      for (var j = 1; j < hourlyData.length; j++) {
        if (hourlyData[j][0] === today) {
          var site = hourlyData[j][1];
          var hours = [];
          for (var h = 0; h < 24; h++) hours.push(hourlyData[j][h + 2] || 0);
          hourlyStats[site] = hours;
        }
      }
    }
  } catch (e) {}

  SITES.forEach(function (site) {
    var liveCount = 0;
    for (var i = 0; i < 30; i++) {
      if (cache.get("ping_" + site + "_" + (now - i))) liveCount++;
    }

    stats[site] = {
      live: Math.min(liveCount, 999),
      today: sheetTodayTotals[site] || parseInt(cache.get("total_" + site + "_" + today) || "0"),
      total: sheetAllTimeTotals[site] || 0,
      hourly: hourlyStats[site] || new Array(24).fill(0)
    };
  });

  return stats;
}

// ─── 유틸리티 ───────────────────────────────────────────────────

function getTodayKST() {
  var now = new Date();
  var kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split("T")[0];
}

function getHourKST() {
  var now = new Date();
  var kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.getUTCHours();
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}
