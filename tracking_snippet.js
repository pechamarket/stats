(function () {
    // Instructions: Replace YOUR_GAS_URL_HERE with your deployed Google Apps Script URL
    var GAS_URL = "https://script.google.com/macros/s/AKfycbxKeICtnye1vJVbNuJjx7wCwH3pIxnt2ELJaIXzS0SCxF44kMNdyIx4qNjvj5CWhKlv/exec";
    var SITE_NAME = window.location.hostname;

    function sendPing() {
        var url = GAS_URL + "?site=" + encodeURIComponent(SITE_NAME) + "&t=" + Date.now();
        fetch(url, { mode: 'no-cors' }).catch(function (e) { console.debug("ping failed"); });
    }

    // Initial ping
    sendPing();

    // Heartbeat every 20 seconds while page is visible
    setInterval(function () {
        if (!document.hidden) {
            sendPing();
        }
    }, 20000);
})();
