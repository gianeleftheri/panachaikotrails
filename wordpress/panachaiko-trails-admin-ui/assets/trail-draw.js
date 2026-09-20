(function () {
  'use strict';

  var mapElement = document.getElementById('ptTrailDrawMap');
  var geometryInput = document.getElementById('ptGeometry');
  var gpxInput = document.getElementById('ptGpx');
  var mapPanel = document.getElementById('ptDrawPanel');
  var status = document.getElementById('ptDrawStatus');
  var undoButton = document.getElementById('ptDrawUndo');
  var clearButton = document.getElementById('ptDrawClear');
  var locateButton = document.getElementById('ptDrawLocate');
  var methodInputs = document.querySelectorAll('input[name="pt_route_method"]');
  if (!mapElement || !geometryInput || !gpxInput || !mapPanel || !window.L) return;

  var map;
  var line;
  var startMarker;
  var endMarker;
  var points = [];

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

  function syncGeometry() {
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
    status.textContent = points.length < 2
      ? 'Πατήστε τουλάχιστον δύο σημεία στον χάρτη.'
      : points.length + ' σημεία · περίπου ' + totalDistance().toFixed(2) + ' χλμ.';
    undoButton.disabled = points.length === 0;
    clearButton.disabled = points.length === 0;
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
      if (points.length >= 5000) { status.textContent = 'Έχετε φτάσει το όριο των 5.000 σημείων.'; return; }
      points.push([Number(event.latlng.lat.toFixed(7)), Number(event.latlng.lng.toFixed(7))]);
      syncGeometry();
    });
    syncGeometry();
  }

  function selectMethod(value) {
    var drawing = value === 'draw';
    mapPanel.hidden = !drawing;
    gpxInput.required = !drawing;
    if (drawing) ensureMap();
  }

  methodInputs.forEach(function (input) {
    input.addEventListener('change', function () { selectMethod(input.value); });
    if (input.checked) selectMethod(input.value);
  });

  undoButton.addEventListener('click', function () { points.pop(); syncGeometry(); });
  clearButton.addEventListener('click', function () { points = []; syncGeometry(); });
  locateButton.addEventListener('click', function () {
    if (!navigator.geolocation) { status.textContent = 'Η συσκευή δεν υποστηρίζει εντοπισμό θέσης.'; return; }
    locateButton.disabled = true;
    navigator.geolocation.getCurrentPosition(function (position) {
      map.setView([position.coords.latitude, position.coords.longitude], 15);
      locateButton.disabled = false;
    }, function () {
      status.textContent = 'Δεν ήταν δυνατός ο εντοπισμός της θέσης σας.';
      locateButton.disabled = false;
    }, { enableHighAccuracy: true, timeout: 10000 });
  });
}());
