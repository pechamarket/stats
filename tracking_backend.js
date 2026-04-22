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
var SITES = ["pecha.life", "119pecha.life", "pecha.shop", "pecha.cyou", "pecha.bond", "pechamarket.github.io"];

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
    // 방문 핑 기록 (new=1 이면 새 방문으로 간주)
    recordVisit(params.site, params.new === "1");
    output = ContentService.createTextOutput("ok");
  } else {
    output = ContentService.createTextOutput("invalid request");
  }

  return output;
}

function normalizeSiteName(site) {
  if (!site) return "";
  return site.toString().toLowerCase().trim().replace(/^www\./, "");
}

function formatDateSafe(d) {
  if (!d) return "";
  if (d instanceof Date) {
    return Utilities.formatDate(d, "GMT+9", "yyyy-MM-dd");
  }
  var s = d.toString().trim();
  // "2026-04-22 00:00:00" -> "2026-04-22"
  if (s.length >= 10 && s.match(/^\d{4}-\d{2}-\d{2}/)) {
    return s.substring(0, 10);
  }
  return s;
}

// ─── 방문 기록 ──────────────────────────────────────────────────
function recordVisit(site, isNew) {
  var normalizedSite = normalizeSiteName(site);
  if (SITES.indexOf(normalizedSite) === -1) return; 

  var cache = CacheService.getScriptCache();
  var timestamp = Math.floor(Date.now() / 1000);
  var today = getTodayKST();
  var hour = getHourKST();

  // 1. 실시간 핑 캐싱 (현재 접속자용 - 모든 핑에 대해 수행)
  cache.put("ping_" + normalizedSite + "_" + timestamp, "1", 35);

  // 2. 누적 카운트 (새 방문일 때만 또는 캐시가 없을 때만 업데이트 권장하지만, 
  // 기존 로직 호환성을 위해 snippet에서 new=1을 보낼 때만 시트 업데이트하도록 유도 가능)
  // 여기서는 isNew가 true일 때만 시트에 저장하도록 변경하여 '중복 카운팅' 방지
  if (isNew) {
    var cacheKey = "total_" + normalizedSite + "_" + today;
    var currentCached = parseInt(cache.get(cacheKey) || "0");
    cache.put(cacheKey, (currentCached + 1).toString(), 86400);

    try {
      saveToSheet(normalizedSite, today, hour);
    } catch (err) {
      Logger.log("Sheet save error: " + err.toString());
    }
  }
}

// ─── 구글 시트 저장 ─────────────────────────────────────────────
function saveToSheet(site, today, hour) {
  var lock = LockService.getScriptLock();
  try {
    // 최대 30초 동안 락 대기
    lock.waitLock(30000);
    
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var now = new Date();
    var kstFull = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    var timestamp = Utilities.formatDate(kstFull, "GMT+9", "yyyy-MM-dd HH:mm:ss");

    // A. 일일 합계 업데이트 (visitors 시트)
    var dailySheet = getOrCreateSheet(ss, "visitors");
    if (dailySheet.getLastRow() === 0) {
      dailySheet.appendRow(["date", "site", "total"]);
      dailySheet.getRange(1, 1, 1, 3).setFontWeight("bold");
    }

    var dailyData = dailySheet.getDataRange().getValues();
    var dailyRowIndex = -1;
    for (var i = 1; i < dailyData.length; i++) {
      if (formatDateSafe(dailyData[i][0]) === today && normalizeSiteName(dailyData[i][1]) === site) {
        dailyRowIndex = i + 1;
        break;
      }
    }

    if (dailyRowIndex === -1) {
      // 날짜를 문자열로 강제 저장 (' 접두어 사용)
      dailySheet.appendRow(["'" + today, site, 1]);
    } else {
      var cell = dailySheet.getRange(dailyRowIndex, 3);
      var currentVal = parseInt(cell.getValue()) || 0;
      cell.setValue(currentVal + 1);
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
      if (formatDateSafe(hourlyData[j][0]) === today && normalizeSiteName(hourlyData[j][1]) === site) {
        hourlyRowIndex = j + 1;
        break;
      }
    }

    if (hourlyRowIndex === -1) {
      var newRow = ["'" + today, site];
      for (var k = 0; k < 24; k++) newRow.push(k === hour ? 1 : 0);
      hourlySheet.appendRow(newRow);
    } else {
      var hourCell = hourlySheet.getRange(hourlyRowIndex, hour + 3);
      var currentHVal = parseInt(hourCell.getValue()) || 0;
      hourCell.setValue(currentHVal + 1);
    }

    // C. 상세 로그 기록 (raw_logs 시트)
    var logsSheet = getOrCreateSheet(ss, "raw_logs");
    if (logsSheet.getLastRow() === 0) {
      logsSheet.appendRow(["timestamp", "date", "site"]);
      logsSheet.getRange(1, 1, 1, 3).setFontWeight("bold");
      logsSheet.setFrozenRows(1);
    }
    logsSheet.appendRow([timestamp, "'" + today, site]);

  } catch (e) {
    Logger.log("Error in saveToSheet: " + e.toString());
  } finally {
    lock.releaseLock();
  }
}

// ─── 통계 조회 ──────────────────────────────────────────────────
function getVisitorStats() {
  var cache = CacheService.getScriptCache();
  var now = Math.floor(Date.now() / 1000);
  var today = getTodayKST();
  var stats = {};

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // 1. 일일 데이터 및 히스토리 가져오기
  var sheetTodayTotals = {};
  var sheetAllTimeTotals = {};
  var dailyHistory = {};
  try {
    var dailySheet = ss.getSheetByName("visitors");
    if (dailySheet && dailySheet.getLastRow() > 1) {
      var dailyData = dailySheet.getDataRange().getValues();
      for (var i = 1; i < dailyData.length; i++) {
        var rowDate = formatDateSafe(dailyData[i][0]);
        var rowSite = normalizeSiteName(dailyData[i][1]);
        var rowCount = parseInt(dailyData[i][2]) || 0;
        
        sheetAllTimeTotals[rowSite] = (sheetAllTimeTotals[rowSite] || 0) + rowCount;
        if (rowDate === today) {
          sheetTodayTotals[rowSite] = (sheetTodayTotals[rowSite] || 0) + rowCount;
        }
        
        if (!dailyHistory[rowSite]) dailyHistory[rowSite] = {};
        dailyHistory[rowSite][rowDate] = (dailyHistory[rowSite][rowDate] || 0) + rowCount;
      }
    }
  } catch (e) {}

  // 히스토리 데이터를 배열로 변환 및 정렬
  var formattedHistory = {};
  for (var s in dailyHistory) {
    formattedHistory[s] = [];
    for (var d in dailyHistory[s]) {
      formattedHistory[s].push({ date: d, count: dailyHistory[s][d] });
    }
    formattedHistory[s].sort(function(a, b) {
      return b.date.localeCompare(a.date);
    });
  }

  // 2. 시간별 데이터 가져오기 (오늘 기준)
  var hourlyStats = {};
  try {
    var hourlySheet = ss.getSheetByName("hourly");
    if (hourlySheet && hourlySheet.getLastRow() > 1) {
      var hData = hourlySheet.getDataRange().getValues();
      for (var j = 1; j < hData.length; j++) {
        var hDate = hData[j][0];
        if (hDate instanceof Date) {
          hDate = Utilities.formatDate(hDate, "GMT+9", "yyyy-MM-dd");
        } else {
          hDate = hDate.toString().trim();
        }

        if (hDate === today) {
          var hSite = normalizeSiteName(hData[j][1]);
          var hours = [];
          for (var h = 0; h < 24; h++) hours.push(hData[j][h + 2] || 0);
          
          if (!hourlyStats[hSite]) {
            hourlyStats[hSite] = hours;
          } else {
            // 이미 있으면 (중복 행일 경우) 합산
            for (var k = 0; k < 24; k++) hourlyStats[hSite][k] += (hours[k] || 0);
          }
        }
      }
    }
  } catch (e) {}

  SITES.forEach(function (site) {
    var liveCount = 0;
    for (var i = 0; i < 30; i++) {
      if (cache.get("ping_" + site + "_" + (now - i))) liveCount++;
    }

    var cacheVal = parseInt(cache.get("total_" + site + "_" + today) || "0");
    var todayFinal = Math.max(sheetTodayTotals[site] || 0, cacheVal);

    stats[site] = {
      live: Math.min(liveCount, 999),
      today: todayFinal,
      total: sheetAllTimeTotals[site] || 0,
      hourly: hourlyStats[site] || new Array(24).fill(0),
      history: formattedHistory[site] || []
    };
  });

  return stats;
}

// ─── 유틸리티 ───────────────────────────────────────────────────

function getTodayKST() {
  return Utilities.formatDate(new Date(), "GMT+9", "yyyy-MM-dd");
}

function getHourKST() {
  return parseInt(Utilities.formatDate(new Date(), "GMT+9", "HH"));
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}
