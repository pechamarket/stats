(function () {
    // Instructions: Replace YOUR_GAS_URL_HERE with your deployed Google Apps Script URL
    var GAS_URL = "https://script.google.com/macros/s/AKfycbxKeICtnye1vJVbNuJjx7wCwH3pIxnt2ELJaIXzS0SCxF44kMNdyIx4qNjvj5CWhKlv/exec";
    var SITE_NAME = window.location.hostname;

    var isNew = !sessionStorage.getItem('tracked_' + SITE_NAME);
    if (isNew) sessionStorage.setItem('tracked_' + SITE_NAME, 'true');

    function sendPing(isFirst) {
        var url = GAS_URL + "?site=" + encodeURIComponent(SITE_NAME) + "&t=" + Date.now();
        if (isFirst) url += "&new=1";
        fetch(url, { mode: 'no-cors' }).catch(function (e) { console.debug("ping failed"); });
    }

    // Initial ping
    sendPing(isNew);

    // Heartbeat every 20 seconds while page is visible
    setInterval(function () {
        if (!document.hidden) {
            sendPing();
        }
    }, 20000);
})();
