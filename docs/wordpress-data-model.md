# Panachaiko Trails — WordPress data model

## Στόχος

Το WordPress θα είναι το headless CMS / διαχειριστικό του Panachaiko Trails. Το Astro/Vercel παραμένει το public frontend.

Η βασική αρχή είναι ότι ο frontend χάρτης δεν πρέπει να γνωρίζει πώς αποθηκεύονται τα δεδομένα στο WordPress. Ένα μικρό API adapter θα μετατρέπει το WordPress model στο ήδη υπάρχον `Trail` shape που χρησιμοποιεί το Astro.

## 1. Custom Post Type: `trail`

Κάθε μονοπάτι είναι ένα WordPress post τύπου `trail`.

### Βασικά πεδία

| WordPress field | Type | Required | Σημείωση |
| --- | --- | --- | --- |
| post_title | core title | yes | Καθαρό όνομα διαδρομής |
| post_content | core editor | no | Περιγραφή / γενικές πληροφορίες |
| trail_code | text | yes | Μοναδικός κωδικός, π.χ. `Π-4` |
| trail_stage | select | yes | `existing`, `planned`, `investigation` |
| trail_color | color/text | yes | Χρώμα προβολής χάρτη |
| length_km | decimal | yes | Συνολικό μήκος σε χλμ |
| elev_min | integer/null | no | Ελάχιστο υψόμετρο |
| elev_max | integer/null | no | Μέγιστο υψόμετρο |
| gain_m | integer | yes | Συνολική ανάβαση |
| loss_m | integer | yes | Συνολική κατάβαση |
| geometry_json | JSON text | yes | GeoJSON `MultiLineString`, συντεταγμένες `[lng, lat, elevation|null]` |
| data_source | text | no | Πηγή δεδομένων, π.χ. ΟΦΥΠΕΚΑ |
| last_verified_at | datetime | no | Τελευταία επιβεβαίωση στοιχείων |

### Γιατί `trail_stage` αντί για boolean `existing`

Τα σημερινά δεδομένα έχουν περισσότερες από δύο πραγματικές καταστάσεις. Το API θα υπολογίζει για συμβατότητα:

```text
existing = trail_stage === "existing"
```

Έτσι ο σημερινός frontend δεν χρειάζεται να αλλάξει αμέσως, ενώ το WordPress κρατά σωστότερο μοντέλο.

## 2. Γεωμετρία διαδρομής

Δεν χρησιμοποιούμε ACF repeater για χιλιάδες σημεία.

Η γεωμετρία αποθηκεύεται ως ένα JSON/GeoJSON document:

```json
{
  "type": "MultiLineString",
  "coordinates": [
    [[21.82, 38.21, 820], [21.821, 38.212, 825]],
    [[21.83, 38.22, null], [21.831, 38.221, null]]
  ]
}
```

Το τρίτο coordinate είναι υψόμετρο και επιτρέπεται να είναι `null` κατά τη μεταφορά των παλιών δεδομένων.

## 3. Custom Post Type: `trail_poi`

Οι ενδείξεις, τα καταφύγια και το μελλοντικό user-generated content δεν αποθηκεύονται ως μεγάλο nested repeater μέσα στο Trail.

Κάθε σημείο είναι ξεχωριστό `trail_poi`.

| WordPress field | Type | Required | Σημείωση |
| --- | --- | --- | --- |
| post_title | core title | yes | Τίτλος σημείου |
| post_content | core editor | no | Περιγραφή |
| related_trail | relationship/post ID | yes | Σύνδεση με `trail` |
| poi_type | select | yes | `note`, `shelter`, `hazard`, `water`, `viewpoint`, `photo`, `video`, `general` |
| latitude | decimal | yes | Latitude |
| longitude | decimal | yes | Longitude |
| media_ids | attachment IDs | no | Φωτογραφίες / media |
| external_video_url | URL | no | Προαιρετικό video URL |
| submitted_by | user ID | no | Για μελλοντικές υποβολές |
| verified_at | datetime | no | Επιβεβαίωση από διαχειριστή |

Για moderation χρησιμοποιούμε τα native WordPress post statuses: `pending`, `draft`, `publish`.

Τα καταφύγια είναι `trail_poi` με `poi_type = shelter`, ώστε το SOS feature να μπορεί να τα βρίσκει από το ίδιο API.

## 4. Media

Οι φωτογραφίες αποθηκεύονται στο native WordPress Media Library και συνδέονται με Trail/POI μέσω attachment IDs. Δεν αποθηκεύουμε base64 ή μεγάλα media blobs σε custom fields.

## 5. REST API contract

Ο frontend πρέπει να παίρνει ένα σταθερό shape ανεξάρτητα από τα WordPress internals.

Προτεινόμενο endpoint:

```text
GET /wp-json/panachaiko/v1/trails
GET /wp-json/panachaiko/v1/trails/{trail_code}
```

Παράδειγμα response:

```json
{
  "key": "Π-4",
  "trail": {
    "name": "Μπάλα - Κοκκινόβρυση",
    "status": "planned",
    "existing": false,
    "color": "#facc15",
    "length_km": 4.95,
    "elev_min": 389,
    "elev_max": 1056,
    "gain_m": 687,
    "loss_m": 25,
    "segments": [],
    "photos": [],
    "videos": [],
    "notes": []
  }
}
```

Το API μετατρέπει το GeoJSON `coordinates` σε `segments` για να παραμείνει συμβατό με τον σημερινό Astro κώδικα.

## 6. TypeScript mapping

Το σημερινό frontend χρησιμοποιεί:

```text
TrailPoint = [longitude, latitude, elevation?]
Trail = name + existing + color + length/elevation/gain/loss + segments + photos + videos + notes
```

Στην πρώτη WordPress integration φάση κρατάμε αυτό το contract. Αργότερα μπορούμε να προσθέσουμε `status`, `description`, IDs και timestamps χωρίς να σπάσουμε τον χάρτη.

Τα elevation values πρέπει να γίνουν nullable στο TypeScript model, επειδή τα source δεδομένα περιέχουν ήδη `null`.

## 7. Τι δεν κάνουμε

- Δεν μεταφέρουμε χιλιάδες coordinates σε ACF repeaters.
- Δεν βάζουμε OpenRouteService API key σε WordPress REST response ή frontend bundle.
- Δεν δημιουργούμε ξεχωριστό data model για shelters — είναι POI category.
- Δεν συνδέουμε ακόμα GPS, routing ή 3D με WordPress. Πρώτα μεταφέρουμε τα canonical trail data.

## 8. Σειρά υλοποίησης

1. Register `trail` και `trail_poi` CPTs.
2. Register/meta fields με `show_in_rest` και validation.
3. Δημιουργία custom `/panachaiko/v1/trails` REST endpoint.
4. Import των 13 υπαρχόντων JSON trail files.
5. Έλεγχος API output έναντι του σημερινού TypeScript contract.
6. Δημιουργία Astro WordPress data adapter.
7. Αφαίρεση του runtime dependency από `src/data/trails/*.json` αφού επιβεβαιωθεί το API.
8. Μετά συνεχίζουμε advanced GPS/routing/3D/content submission features.
