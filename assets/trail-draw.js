(function () {
  'use strict';

  var mapElement = document.getElementById('ptTrailDrawMap');
  var geometryInput = document.getElementById('ptGeometry');
  var gpxInput = document.getElementById('ptGpx');
  var gpxPanel = document.getElementById('ptGpxPanel');
  var mapPanel = document.getElementById('ptDrawPanel');
  var drawControls = document.getElementById('ptDrawControls');
  var recordControls = document.getElementById('ptRecordControls');
  var status = document.getElementById('ptDrawStatus');
  var undoButton = document.getElementById('ptDrawUndo');
  var clearButton = document.getElementById('ptDrawClear');
  var locateButton = document.getElementById('ptDrawLocate');
  var recordStart = document.getElementById('ptRecordStart');
  var recordPause = document.getElementById('ptRecordPause');
  var recordStop = document.getElementById('ptRecordStop');
  var recordReset = document.getElementById('ptRecordReset');
  var methodInputs = document.querySelectorAll('input[name="pt_route_method"]');
  if (!mapElement || !geometryInput || !gpxInput || !gpxPanel || !mapPanel || !drawControls || !recordControls || !window.L) return;

  var storageKey = 'panachaikoTrailRecordingV1';
  var map;
  var line;
  var startMarker;
  var endMarker;
  var currentMarker;
  var drawnPoints = [];
  var recordedPoints = [];
  var points = drawnPoints;
  var currentMethod = 'gpx';
  var watchId = null;
  var recording = false;
  var paused = false;
  var wakeLock = null;

  function distanceKm(a, b) {
    var radius = 6371;
    var radians = function (value) { return value * Math.PI / 180; };
    var dLat = radians(b[0] - a[0]);
    var dLng = radians(b[1] - a[1]);
    var value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a[0])) * Math.cos(radians(b[0])) * Math.sin(dLng / 2) ** 2;
    return 2 * radius * Math.asin(Math.sqrt(value));
  }

  function totalDistance() {
    var total = 0;
    for (var index = 1; index < points.length; index += 1) total += distanceKm(points[index - 1], points[index]);
    return total;
  }

  function saveRecording() {
    if (currentMethod !== 'record') return;
    try { localStorage.setItem(storageKey, JSON.stringify({ points: points, savedAt: Date.now() })); } catch (error) {}
  }

  function syncGeometry(message) {
    geometryInput.value = points.length >= 2 ? JSON.stringify({
      type: 'MultiLineString',
      coordinates: [points.map(function (point) { return [point[1], point[0]]; })]
    }) : '';
    line.setLatLngs(points);
    if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
    if (endMarker) { map.removeLayer(endMarker); endMarker = null; }
    if (points.length) {
      startMarker = window.L.marker(points[0], { title: 'Αφετηρία' }).addTo(map).bindTooltip('Αφετηρία Α');
      if (points.length > 1) endMarker = window.L.marker(points[points.length - 1], { title: 'Τερματισμός' }).addTo(map).bindTooltip('Τερματισμός Τ');
    }
    status.textContent = message || (points.length < 2
      ? 'Χρειάζονται τουλάχιστον δύο σημεία.'
      : points.length + ' σημεία · περίπου ' + totalDistance().toFixed(2) + ' χλμ.');
    undoButton.disabled = points.length === 0;
    clearButton.disabled = points.length === 0;
    recordReset.disabled = points.length === 0 || recording;
    saveRecording();
  }

  function ensureMap() {
    if (map) { setTimeout(function () { map.invalidateSize(); }, 50); return; }
    map = window.L.map(mapElement, { zoomControl: true }).setView([38.18, 21.85], 12);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    line = window.L.polyline([], { color: '#ff601f', weight: 5, opacity: 0.9 }).addTo(map);
    map.on('click', function (event) {
      if (currentMethod !== 'draw') return;
      if (points.length >= 5000) { status.textContent = 'Έχετε φτάσει το όριο των 5.000 σημείων.'; return; }
      points.push([Number(event.latlng.lat.toFixed(7)), Number(event.latlng.lng.toFixed(7))]);
      syncGeometry();
    });
    syncGeometry();
  }

  function stopWatch() {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  function releaseWakeLock() {
    if (wakeLock && wakeLock.release) wakeLock.release().catch(function () {});
    wakeLock = null;
  }

  function requestWakeLock() {
    if (!navigator.wakeLock || !navigator.wakeLock.request) return;
    navigator.wakeLock.request('screen').then(function (lock) { wakeLock = lock; }).catch(function () {});
  }

  function onPosition(position) {
    if (!recording || paused) return;
    var accuracy = Number(position.coords.accuracy || 999);
    var point = [Number(position.coords.latitude.toFixed(7)), Number(position.coords.longitude.toFixed(7))];
    if (currentMarker) map.removeLayer(currentMarker);
    currentMarker = window.L.circleMarker(point, { radius: 7, color: '#fff', weight: 2, fillColor: '#0758de', fillOpacity: 1 }).addTo(map);
    map.panTo(point);
    if (accuracy > 60) { syncGeometry('Αδύναμο GPS (' + Math.round(accuracy) + ' μ.). Περιμένω ακριβέστερο στίγμα…'); return; }
    var last = points.length ? points[points.length - 1] : null;
    if (!last || distanceKm(last, point) >= 0.005) points.push(point);
    syncGeometry('Καταγραφή ενεργή · ακρίβεια ' + Math.round(accuracy) + ' μ. · ' + points.length + ' σημεία · ' + totalDistance().toFixed(2) + ' χλμ.');
  }

  function onPositionError(error) {
    var message = error && error.code === 1 ? 'Δεν δόθηκε άδεια πρόσβασης στην τοποθεσία.' : 'Δεν ήταν δυνατή η λήψη GPS. Ελέγξτε το σήμα και δοκιμάστε ξανά.';
    syncGeometry(message);
  }

  function startWatch() {
    if (!navigator.geolocation) { syncGeometry('Η συσκευή δεν υποστηρίζει εντοπισμό θέσης.'); return; }
    stopWatch();
    watchId = navigator.geolocation.watchPosition(onPosition, onPositionError, {
      enableHighAccuracy: true, maximumAge: 3000, timeout: 15000
    });
  }

  function restoreRecording() {
    try {
      var saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved && Array.isArray(saved.points) && saved.points.length && Date.now() - Number(saved.savedAt || 0) < 7 * 86400000) {
        recordedPoints = saved.points.slice(0, 5000);
        points = recordedPoints;
        syncGeometry('Επαναφέρθηκε η τελευταία καταγραφή · ' + points.length + ' σημεία · ' + totalDistance().toFixed(2) + ' χλμ.');
        map.fitBounds(line.getBounds(), { padding: [25, 25] });
      }
    } catch (error) {}
  }

  function selectMethod(value) {
    currentMethod = value;
    if (value === 'draw') points = drawnPoints;
    if (value === 'record') points = recordedPoints;
    var mapMode = value === 'draw' || value === 'record';
    mapPanel.hidden = !mapMode;
    gpxPanel.hidden = mapMode;
    drawControls.hidden = value !== 'draw';
    recordControls.hidden = value !== 'record';
    gpxInput.required = value === 'gpx';
    if (mapMode) {
      ensureMap();
      if (value === 'record' && points.length === 0) restoreRecording();
      else syncGeometry();
    }
    if (value !== 'record' && recording) {
      recording = false; paused = false; stopWatch(); releaseWakeLock();
    }
  }

  methodInputs.forEach(function (input) {
    input.addEventListener('change', function () { selectMethod(input.value); });
    if (input.checked) selectMethod(input.value);
  });

  undoButton.addEventListener('click', function () { points.pop(); syncGeometry(); });
  clearButton.addEventListener('click', function () { drawnPoints = []; points = drawnPoints; syncGeometry(); });
  locateButton.addEventListener('click', function () {
    if (!navigator.geolocation) { syncGeometry('Η συσκευή δεν υποστηρίζει εντοπισμό θέσης.'); return; }
    locateButton.disabled = true;
    navigator.geolocation.getCurrentPosition(function (position) {
      map.setView([position.coords.latitude, position.coords.longitude], 15);
      locateButton.disabled = false;
    }, function () {
      syncGeometry('Δεν ήταν δυνατός ο εντοπισμός της θέσης σας.');
      locateButton.disabled = false;
    }, { enableHighAccuracy: true, timeout: 10000 });
  });

  recordStart.addEventListener('click', function () {
    recording = true; paused = false;
    recordStart.disabled = true; recordPause.disabled = false; recordStop.disabled = false; recordReset.disabled = true;
    recordPause.textContent = 'Παύση';
    requestWakeLock(); startWatch();
    syncGeometry('Η καταγραφή ξεκίνησε. Κρατήστε τη σελίδα ανοικτή και την οθόνη ενεργή.');
  });

  recordPause.addEventListener('click', function () {
    paused = !paused;
    if (paused) { stopWatch(); recordPause.textContent = 'Συνέχεια'; syncGeometry('Η καταγραφή είναι σε παύση.'); }
    else { startWatch(); recordPause.textContent = 'Παύση'; syncGeometry('Η καταγραφή συνεχίζεται…'); }
  });

  recordStop.addEventListener('click', function () {
    recording = false; paused = false; stopWatch(); releaseWakeLock();
    recordStart.disabled = false; recordPause.disabled = true; recordStop.disabled = true; recordReset.disabled = points.length === 0;
    recordPause.textContent = 'Παύση';
    syncGeometry(points.length >= 2 ? 'Η καταγραφή ολοκληρώθηκε · ' + totalDistance().toFixed(2) + ' χλμ. Πατήστε «Αποστολή για έλεγχο».' : 'Δεν καταγράφηκαν αρκετά σημεία.');
  });

  recordReset.addEventListener('click', function () {
    recordedPoints = [];
    points = recordedPoints;
    try { localStorage.removeItem(storageKey); } catch (error) {}
    syncGeometry('Η αποθηκευμένη καταγραφή καθαρίστηκε.');
  });

  window.addEventListener('beforeunload', function () {
    if (recording) saveRecording();
    stopWatch(); releaseWakeLock();
  });
}());
