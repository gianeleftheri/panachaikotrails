<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

final class Panachaiko_Recreation_Spots {
    private const SEED_VERSION = '1';
    private const SOURCE_URL = 'https://e-patras.gr/el/qrcode-panahaiko';

    public static function init(): void {
        add_action( 'init', array( __CLASS__, 'register_post_type' ) );
        add_action( 'init', array( __CLASS__, 'register_meta' ) );
        add_action( 'init', array( __CLASS__, 'maybe_seed' ), 40 );
        add_action( 'add_meta_boxes', array( __CLASS__, 'add_meta_box' ) );
        add_action( 'save_post_recreation_spot', array( __CLASS__, 'save_meta' ) );
        add_action( 'rest_api_init', array( __CLASS__, 'register_rest_routes' ) );
        add_filter( 'manage_recreation_spot_posts_columns', array( __CLASS__, 'columns' ) );
        add_action( 'manage_recreation_spot_posts_custom_column', array( __CLASS__, 'render_column' ), 10, 2 );
    }

    public static function register_post_type(): void {
        register_post_type(
            'recreation_spot',
            array(
                'labels' => array(
                    'name'               => 'Χώροι Αναψυχής',
                    'singular_name'      => 'Χώρος Αναψυχής',
                    'menu_name'          => 'Χώροι Αναψυχής',
                    'add_new'            => 'Προσθήκη',
                    'add_new_item'       => 'Προσθήκη χώρου αναψυχής',
                    'edit_item'          => 'Επεξεργασία χώρου αναψυχής',
                    'new_item'           => 'Νέος χώρος αναψυχής',
                    'view_item'          => 'Προβολή χώρου αναψυχής',
                    'search_items'       => 'Αναζήτηση χώρων αναψυχής',
                    'not_found'          => 'Δεν βρέθηκαν χώροι αναψυχής',
                    'not_found_in_trash' => 'Δεν βρέθηκαν χώροι αναψυχής στον κάδο',
                ),
                'public'              => false,
                'show_ui'             => true,
                'show_in_rest'        => true,
                'menu_icon'           => 'dashicons-palmtree',
                'menu_position'       => 21,
                'supports'            => array( 'title', 'editor', 'thumbnail', 'revisions', 'page-attributes' ),
                'has_archive'         => false,
                'rewrite'             => false,
                'exclude_from_search' => true,
            )
        );
    }

    public static function register_meta(): void {
        $common = array(
            'single' => true,
            'show_in_rest' => true,
            'auth_callback' => static fn() => current_user_can( 'edit_posts' ),
        );

        register_post_meta( 'recreation_spot', 'recreation_spot_type', $common + array(
            'type' => 'string',
            'sanitize_callback' => array( __CLASS__, 'sanitize_spot_type' ),
        ) );
        register_post_meta( 'recreation_spot', 'settlement', $common + array(
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field',
        ) );
        register_post_meta( 'recreation_spot', 'source_url', $common + array(
            'type' => 'string',
            'sanitize_callback' => 'esc_url_raw',
        ) );
        register_post_meta( 'recreation_spot', 'recreation_seed_key', $common + array(
            'type' => 'string',
            'sanitize_callback' => 'sanitize_key',
        ) );

        foreach ( array( 'latitude', 'longitude', 'elevation_m' ) as $field ) {
            register_post_meta( 'recreation_spot', $field, $common + array(
                'type' => 'number',
                'sanitize_callback' => array( __CLASS__, 'sanitize_number_or_null' ),
            ) );
        }
    }

    public static function add_meta_box(): void {
        add_meta_box(
            'panachaiko_recreation_details',
            'Στοιχεία χώρου αναψυχής',
            array( __CLASS__, 'render_meta_box' ),
            'recreation_spot',
            'normal',
            'high'
        );
    }

    public static function render_meta_box( WP_Post $post ): void {
        wp_nonce_field( 'panachaiko_save_recreation_spot', 'panachaiko_recreation_nonce' );
        $type = (string) get_post_meta( $post->ID, 'recreation_spot_type', true ) ?: 'recreation_viewpoint';
        $settlement = (string) get_post_meta( $post->ID, 'settlement', true );
        $lat = get_post_meta( $post->ID, 'latitude', true );
        $lng = get_post_meta( $post->ID, 'longitude', true );
        $elevation = get_post_meta( $post->ID, 'elevation_m', true );
        $source_url = (string) get_post_meta( $post->ID, 'source_url', true );
        ?>
        <style>
          .panachaiko-recreation-grid{display:grid;grid-template-columns:repeat(2,minmax(220px,1fr));gap:16px 20px}
          .panachaiko-recreation-grid .wide{grid-column:1/-1}
          .panachaiko-recreation-grid label{display:block;font-weight:600;margin-bottom:6px}
          .panachaiko-recreation-grid input,.panachaiko-recreation-grid select{width:100%}
          .panachaiko-recreation-help{margin:6px 0 0;color:#646970}
          @media(max-width:782px){.panachaiko-recreation-grid{grid-template-columns:1fr}}
        </style>
        <div class="panachaiko-recreation-grid">
          <div>
            <label for="panachaiko_recreation_type">Τύπος σημείου</label>
            <select id="panachaiko_recreation_type" name="panachaiko_recreation_type">
              <option value="recreation_viewpoint" <?php selected( $type, 'recreation_viewpoint' ); ?>>Χώρος αναψυχής / θέας</option>
              <option value="watchtower_site" <?php selected( $type, 'watchtower_site' ); ?>>Θέση πυροφυλακίου / θέας</option>
              <option value="other" <?php selected( $type, 'other' ); ?>>Άλλο σημείο ενδιαφέροντος</option>
            </select>
          </div>
          <div>
            <label for="panachaiko_recreation_settlement">Οικισμός / περιοχή</label>
            <input id="panachaiko_recreation_settlement" name="panachaiko_recreation_settlement" type="text" value="<?php echo esc_attr( $settlement ); ?>" />
          </div>
          <div>
            <label for="panachaiko_recreation_lat">Γεωγραφικό πλάτος (lat)</label>
            <input id="panachaiko_recreation_lat" name="panachaiko_recreation_lat" type="number" step="0.000001" min="-90" max="90" value="<?php echo esc_attr( $lat ); ?>" />
          </div>
          <div>
            <label for="panachaiko_recreation_lng">Γεωγραφικό μήκος (lng)</label>
            <input id="panachaiko_recreation_lng" name="panachaiko_recreation_lng" type="number" step="0.000001" min="-180" max="180" value="<?php echo esc_attr( $lng ); ?>" />
          </div>
          <div>
            <label for="panachaiko_recreation_elevation">Υψόμετρο (μ.)</label>
            <input id="panachaiko_recreation_elevation" name="panachaiko_recreation_elevation" type="number" step="1" min="0" value="<?php echo esc_attr( $elevation ); ?>" />
          </div>
          <div>
            <label for="panachaiko_recreation_source">Πηγή πληροφοριών</label>
            <input id="panachaiko_recreation_source" name="panachaiko_recreation_source" type="url" value="<?php echo esc_attr( $source_url ); ?>" placeholder="<?php echo esc_attr( self::SOURCE_URL ); ?>" />
          </div>
          <div class="wide">
            <p class="panachaiko-recreation-help"><strong>Περιγραφή:</strong> γράφεται στον βασικό επεξεργαστή κειμένου πιο πάνω. <strong>Φωτογραφία:</strong> ορίζεται από την «Εικόνα άρθρου». Οι συντεταγμένες χρησιμοποιούνται για την πινέζα στον κεντρικό χάρτη.</p>
          </div>
        </div>
        <?php
    }

    public static function save_meta( int $post_id ): void {
        if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) return;
        if ( wp_is_post_revision( $post_id ) ) return;
        if ( ! isset( $_POST['panachaiko_recreation_nonce'] ) ) return;
        if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['panachaiko_recreation_nonce'] ) ), 'panachaiko_save_recreation_spot' ) ) return;
        if ( ! current_user_can( 'edit_post', $post_id ) ) return;

        $type = isset( $_POST['panachaiko_recreation_type'] )
            ? self::sanitize_spot_type( sanitize_text_field( wp_unslash( $_POST['panachaiko_recreation_type'] ) ) )
            : 'recreation_viewpoint';
        update_post_meta( $post_id, 'recreation_spot_type', $type );

        self::save_text( $post_id, 'settlement', 'panachaiko_recreation_settlement' );
        self::save_number( $post_id, 'latitude', 'panachaiko_recreation_lat' );
        self::save_number( $post_id, 'longitude', 'panachaiko_recreation_lng' );
        self::save_number( $post_id, 'elevation_m', 'panachaiko_recreation_elevation' );

        if ( isset( $_POST['panachaiko_recreation_source'] ) ) {
            $value = esc_url_raw( wp_unslash( $_POST['panachaiko_recreation_source'] ) );
            $value ? update_post_meta( $post_id, 'source_url', $value ) : delete_post_meta( $post_id, 'source_url' );
        }
    }

    public static function register_rest_routes(): void {
        register_rest_route( 'panachaiko/v1', '/recreation-spots', array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => array( __CLASS__, 'get_spots' ),
            'permission_callback' => '__return_true',
        ) );
    }

    public static function get_spots( WP_REST_Request $request ): WP_REST_Response {
        $posts = get_posts( array(
            'post_type' => 'recreation_spot',
            'post_status' => 'publish',
            'posts_per_page' => -1,
            'orderby' => array( 'menu_order' => 'ASC', 'title' => 'ASC' ),
        ) );

        return rest_ensure_response( array_values( array_filter( array_map( array( __CLASS__, 'format_spot' ), $posts ) ) ) );
    }

    private static function format_spot( WP_Post $post ): ?array {
        $lat = self::nullable_number_meta( $post->ID, 'latitude' );
        $lng = self::nullable_number_meta( $post->ID, 'longitude' );
        if ( null === $lat || null === $lng ) return null;

        $featured = get_the_post_thumbnail_url( $post, 'large' );
        return array(
            'id' => $post->ID,
            'title' => get_the_title( $post ),
            'description' => wp_strip_all_tags( $post->post_content ),
            'description_html' => wp_kses_post( apply_filters( 'the_content', $post->post_content ) ),
            'type' => (string) get_post_meta( $post->ID, 'recreation_spot_type', true ) ?: 'recreation_viewpoint',
            'settlement' => (string) get_post_meta( $post->ID, 'settlement', true ),
            'lat' => $lat,
            'lng' => $lng,
            'elevation_m' => self::nullable_number_meta( $post->ID, 'elevation_m' ),
            'featured_image_url' => is_string( $featured ) ? $featured : null,
            'source_url' => (string) get_post_meta( $post->ID, 'source_url', true ),
        );
    }

    public static function maybe_seed(): void {
        if ( get_option( 'panachaiko_recreation_seed_version' ) === self::SEED_VERSION ) return;

        foreach ( self::seed_data() as $index => $spot ) {
            $existing = get_posts( array(
                'post_type' => 'recreation_spot',
                'post_status' => 'any',
                'posts_per_page' => 1,
                'fields' => 'ids',
                'meta_key' => 'recreation_seed_key',
                'meta_value' => $spot['key'],
            ) );
            if ( $existing ) continue;

            $post_id = wp_insert_post( array(
                'post_type' => 'recreation_spot',
                'post_status' => 'publish',
                'post_title' => $spot['title'],
                'post_content' => $spot['description'],
                'menu_order' => $index + 1,
            ), true );
            if ( is_wp_error( $post_id ) ) continue;

            update_post_meta( $post_id, 'recreation_seed_key', $spot['key'] );
            update_post_meta( $post_id, 'recreation_spot_type', $spot['type'] );
            update_post_meta( $post_id, 'settlement', $spot['settlement'] );
            update_post_meta( $post_id, 'latitude', $spot['lat'] );
            update_post_meta( $post_id, 'longitude', $spot['lng'] );
            update_post_meta( $post_id, 'elevation_m', $spot['elevation'] );
            update_post_meta( $post_id, 'source_url', self::SOURCE_URL );
        }

        update_option( 'panachaiko_recreation_seed_version', self::SEED_VERSION, false );
    }

    private static function seed_data(): array {
        return array(
            array(
                'key' => 'tranos-vrachos',
                'title' => 'Τρανός Βράχος',
                'type' => 'recreation_viewpoint',
                'settlement' => 'Σούλι / Ελικίστρα',
                'lat' => 38.201704,
                'lng' => 21.799969,
                'elevation' => 740,
                'description' => 'Θέση νοτιοδυτικά του Πουρναρόκαστρου, προς την κατεύθυνση του Chalet, με πρόσβαση από βατό χωματόδρομο. Προσφέρει πανοραμική θέα προς τον Πατραϊκό κόλπο, το Μεσολόγγι και τη Γέφυρα Ρίου–Αντιρρίου.',
            ),
            array(
                'key' => 'agios-ioannis-kokkinovrysi',
                'title' => 'Άγιος Ιωάννης – Κοκκινόβρυση',
                'type' => 'recreation_viewpoint',
                'settlement' => 'Ελικίστρα / Βούντενη',
                'lat' => 38.230763,
                'lng' => 21.831333,
                'elevation' => 1094,
                'description' => 'Χώρος στον προαύλιο χώρο του ξωκλησιού του Αγίου Ιωάννη, περίπου 500 μέτρα μετά τον ασφαλτοστρωμένο δρόμο Ελικίστρα – Ζάστοβα – Κοκκινόβρυση. Η προσέγγιση περνά μέσα από δάσος κεφαλληνιακής ελάτης.',
            ),
            array(
                'key' => 'lakka-sorous',
                'title' => 'Λάκκα Σορούς',
                'type' => 'recreation_viewpoint',
                'settlement' => 'Μοίρα',
                'lat' => 38.167958,
                'lng' => 21.829067,
                'elevation' => 695,
                'description' => 'Βρίσκεται στον ασφαλτοστρωμένο δρόμο Αγίου Ιωάννη Σουλίου – Μοίρας, περίπου δύο χιλιόμετρα πριν από τη Μοίρα. Η θέση προσφέρει θέα προς την κοιλάδα του Γλαύκου και τον Πατραϊκό κόλπο.',
            ),
            array(
                'key' => 'mintzaika',
                'title' => 'Μιντζαίικα',
                'type' => 'recreation_viewpoint',
                'settlement' => 'Σούλι',
                'lat' => 38.182962,
                'lng' => 21.820551,
                'elevation' => 645,
                'description' => 'Μικρό πλάτωμα στον ασφαλτοστρωμένο δρόμο προς τον Άγιο Ιωάννη Σουλίου, πριν από τα Μιντζαίικα. Προσφέρει θέα προς την κοιλάδα του Γλαύκου, τον Πατραϊκό κόλπο και τις γύρω ορεινές πλαγιές.',
            ),
            array(
                'key' => 'skala-vountenis',
                'title' => 'Σκάλα Βούντενης',
                'type' => 'watchtower_site',
                'settlement' => 'Βούντενη',
                'lat' => 38.254820,
                'lng' => 21.818761,
                'elevation' => 620,
                'description' => 'Θέση στον δρόμο Βούντενη – Δραγώλενα – Κοκκινόβρυση, περίπου δύο χιλιόμετρα από τη Βούντενη. Προσφέρει θέα προς τον Χάραδρο και προς τις περιοχές του Ρίου και του Άνω Καστριτσίου.',
            ),
            array(
                'key' => 'profitis-ilias-pournarokastro',
                'title' => 'Προφήτης Ηλίας Πουρναρόκαστρο',
                'type' => 'watchtower_site',
                'settlement' => 'Ελικίστρα',
                'lat' => 38.211121,
                'lng' => 21.810584,
                'elevation' => 694,
                'description' => 'Σημείο στο Πουρναρόκαστρο, στον λόφο του Προφήτη Ηλία με το ομώνυμο εκκλησάκι. Η θέση προσφέρει πανοραμική θέα 360° στην ευρύτερη περιοχή.',
            ),
        );
    }

    public static function columns( array $columns ): array {
        $result = array();
        foreach ( $columns as $key => $label ) {
            $result[ $key ] = $label;
            if ( 'title' === $key ) {
                $result['recreation_type'] = 'Τύπος';
                $result['recreation_settlement'] = 'Περιοχή';
                $result['recreation_elevation'] = 'Υψόμετρο';
                $result['recreation_coords'] = 'Συντεταγμένες';
            }
        }
        return $result;
    }

    public static function render_column( string $column, int $post_id ): void {
        if ( 'recreation_type' === $column ) {
            $type = (string) get_post_meta( $post_id, 'recreation_spot_type', true );
            echo esc_html( 'watchtower_site' === $type ? 'Πυροφυλάκιο / θέα' : ( 'other' === $type ? 'Άλλο' : 'Αναψυχή / θέα' ) );
        } elseif ( 'recreation_settlement' === $column ) {
            echo esc_html( (string) get_post_meta( $post_id, 'settlement', true ) );
        } elseif ( 'recreation_elevation' === $column ) {
            $value = get_post_meta( $post_id, 'elevation_m', true );
            echo '' !== (string) $value ? esc_html( $value . ' μ.' ) : '—';
        } elseif ( 'recreation_coords' === $column ) {
            $lat = get_post_meta( $post_id, 'latitude', true );
            $lng = get_post_meta( $post_id, 'longitude', true );
            echo is_numeric( $lat ) && is_numeric( $lng ) ? esc_html( number_format( (float) $lat, 6, '.', '' ) . ', ' . number_format( (float) $lng, 6, '.', '' ) ) : '—';
        }
    }

    public static function sanitize_spot_type( $value ): string {
        $value = sanitize_key( (string) $value );
        return in_array( $value, array( 'recreation_viewpoint', 'watchtower_site', 'other' ), true ) ? $value : 'recreation_viewpoint';
    }

    public static function sanitize_number_or_null( $value ) {
        if ( '' === $value || null === $value ) return null;
        return is_numeric( $value ) ? (float) $value : null;
    }

    private static function nullable_number_meta( int $post_id, string $key ) {
        $value = get_post_meta( $post_id, $key, true );
        return is_numeric( $value ) ? (float) $value : null;
    }

    private static function save_text( int $post_id, string $meta_key, string $field_name ): void {
        if ( ! isset( $_POST[ $field_name ] ) ) return;
        $value = sanitize_text_field( wp_unslash( $_POST[ $field_name ] ) );
        '' === $value ? delete_post_meta( $post_id, $meta_key ) : update_post_meta( $post_id, $meta_key, $value );
    }

    private static function save_number( int $post_id, string $meta_key, string $field_name ): void {
        if ( ! isset( $_POST[ $field_name ] ) ) return;
        $raw = wp_unslash( $_POST[ $field_name ] );
        if ( '' === (string) $raw ) {
            delete_post_meta( $post_id, $meta_key );
            return;
        }
        if ( is_numeric( $raw ) ) update_post_meta( $post_id, $meta_key, (float) $raw );
    }
}
