# Panachaiko Trails CMS

Headless WordPress plugin for the Panachaiko Trails project.

## Περιλαμβάνει

- Custom Post Type `trail`
- Custom Post Type `trail_poi`
- registered WordPress meta fields
- public read-only REST API
- JSON importer για τα υπάρχοντα trail files

## Εγκατάσταση

1. Αντέγραψε τον φάκελο `panachaiko-trails-cms` στο `wp-content/plugins/` ή δημιούργησε ZIP του φακέλου και εγκατέστησέ το από **Πρόσθετα → Προσθήκη νέου → Μεταφόρτωση πρόσθετου**.
2. Ενεργοποίησε το **Panachaiko Trails CMS**.
3. Στο WordPress admin θα εμφανιστούν τα μενού **Διαδρομές** και **Σημεία διαδρομών**.

## Import των υπαρχόντων trails

1. Άνοιξε **Εργαλεία → Panachaiko Trails Import**.
2. Επίλεξε και τα 13 αρχεία από `src/data/trails/*.json`.
3. Πάτησε **Εισαγωγή διαδρομών**.
4. Ο importer χρησιμοποιεί το `trail_code` ως μοναδικό κλειδί, άρα μπορεί να ξανατρέξει και να ενημερώσει υπάρχουσες εγγραφές.

Η γεωμετρία αποθηκεύεται σαν GeoJSON `MultiLineString` στο `geometry_json`. Δεν χρησιμοποιούνται repeaters για τα χιλιάδες coordinates.

## REST API

Μετά την εισαγωγή:

```text
GET /wp-json/panachaiko/v1/trails
GET /wp-json/panachaiko/v1/trails/{trail_code}
```

Παράδειγμα για μία διαδρομή:

```text
https://cms.panachaikotrails.gr/wp-json/panachaiko/v1/trails/%CE%A0-4
```

Το API διατηρεί συμβατότητα με το σημερινό Astro shape:

```json
{
  "key": "Π-4",
  "trail": {
    "name": "...",
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

## Ασφάλεια

- Τα public endpoints είναι μόνο ανάγνωσης.
- Η επεξεργασία των meta fields απαιτεί WordPress capability `edit_posts`.
- Ο importer απαιτεί `manage_options` και WordPress nonce.
- Δεν αποθηκεύονται routing/API secrets στο REST response ή στο frontend bundle.

## Επόμενο βήμα

Αφού επιβεβαιωθεί ότι το API επιστρέφει σωστά και τις 13 διαδρομές, το Astro data layer θα αλλάξει από local JSON σε `https://cms.panachaikotrails.gr/wp-json/panachaiko/v1/trails`, αρχικά με ασφαλές fallback στα local JSON μέχρι να ολοκληρωθεί ο έλεγχος παραγωγής.
