/**
 * Google Apps Script Backend for Visitor Tracking
 * 
 * Instructions:
 * 1. Go to script.google.com
 * 2. Create a new project
 * 3. Paste this code
 * 4. Deploy > New Deployment > Web App
 * 5. Access: "Anyone"
 * 6. Copy the Web App URL and update it in your dashboard and tracking script.
 */

var SPREADSHEET_ID = ""; // Optional: Add a Sheet ID if you want to log history

function doGet(e) {
  var action = e.parameter.action;
  
  if (action === "getStats") {
    return ContentService.createTextOutput(JSON.stringify(getVisitorStats()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // Tracking ping
  var site = e.parameter.site;
  if (site) {
    recordPing(site);
  }
  
  return ContentService.createTextOutput("ok");
}

function recordPing(site) {
  var cache = CacheService.getScriptCache();
  var timestamp = Math.floor(Date.now() / 1000);
  
  // Store live signal for 30 seconds
  cache.put("ping_" + site + "_" + timestamp, "1", 30);
  
  // Update total count for today in a persistent way
  var today = new Date().toISOString().split('T')[0];
  var totalKey = "total_" + site + "_" + today;
  var currentTotal = parseInt(cache.get(totalKey) || "0");
  cache.put(totalKey, (currentTotal + 1).toString(), 86400); // Keep for 24h
}

function getVisitorStats() {
  var sites = ["pecha.life", "119pecha.life", "pecha.shop", "pecha.cyou"];
  var stats = {};
  var cache = CacheService.getScriptCache();
  var now = Math.floor(Date.now() / 1000);
  var today = new Date().toISOString().split('T')[0];

  sites.forEach(function(site) {
    var liveCount = 0;
    // Check signals from the last 30 seconds
    for (var i = 0; i < 30; i++) {
        if (cache.get("ping_" + site + "_" + (now - i))) {
            liveCount++;
        }
    }
    
    var totalToday = parseInt(cache.get("total_" + site + "_" + today) || "0");
    
    stats[site] = {
      live: Math.min(liveCount, 999), // Basic logic: pings are unique-ish
      total: totalToday
    };
  });

  return stats;
}
