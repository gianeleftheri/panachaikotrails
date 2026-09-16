<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

final class Panachaiko_Trails_Meta {
    public static function init(): void {
        add_action( 'init', array( __CLASS__, 'register' ) );
        add_action( 'add_meta_boxes', array( __CLASS__, 'add_meta_boxes' ) );
        add_action( 'save_post_trail', array( __CLASS__, 'save_trail_meta' ) );
        add_action( 'save_post_trail_poi', array( __CLASS__, 'save_poi_meta' ) );
    }

    public static function register(): void {
        self::register_trail_meta();
        self::register_poi_meta();
    }

    public static function add_meta_boxes(): void {
        add_meta_box(
            'panachaiko_trail_details',
            'Στοιχεία διαδρομής',
            array( __CLASS__, 'render_trail_meta_box' ),
            'trail',
            'normal',
            'high'
        );

        add_meta_box(
            'panachaiko_poi_details',
            'Στοιχεία σημείου διαδρομής',
            array( __CLASS__, 'render_poi_meta_box' ),
            'trail_poi',
            'normal',
            'high'
        );
    }

    private static function register_trail_meta(): void {
        $common = array(
            'single'        => true,
            'show_in_rest'  => true,
            'auth_callback' => static fn() => current_user_can( 'edit_posts' ),
        );

        register_post_meta( 'trail', 'trail_code', $common + array(
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
        ) );

        register_post_meta( 'trail', 'trail_stage', $common + array(
            'type'              => 'string',
            'sanitize_callback' => array( __CLASS__, 'sanitize_trail_stage' ),
        ) );

        register_post_meta( 'trail', 'trail_color', $common + array(
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_hex_color',
        ) );

        foreach ( array( 'length_km', 'elev_min', 'elev_max', 'gain_m', 'loss_m' ) as $field ) {
            register_post_meta( 'trail', $field, $common + array(
                'type'              => 'number',
                'sanitize_callback' => array( __CLASS__, 'sanitize_number_or_null' ),
            ) );
        }

        register_post_meta( 'trail', 'geometry_json', $common + array(
            'type'              => 'string',
            'sanitize_callback' => array( __CLASS__, 'sanitize_geometry_json' ),
        ) );

        register_post_meta( 'trail', 'data_source', $common + array(
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
        ) );

        register_post_meta( 'trail', 'last_verified_at', $common + array(
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
        ) );
    }

    private static function register_poi_meta(): void {
        $common = array(
            'single'        => true,
            'show_in_rest'  => true,
            'auth_callback' => static fn() => current_user_can( 'edit_posts' ),
        );

        register_post_meta( 'trail_poi', 'related_trail', $common + array(
            'type'              => 'integer',
            'sanitize_callback' => 'absint',
        ) );

        register_post_meta( 'trail_poi', 'poi_type', $common + array(
            'type'              => 'string',
            'sanitize_callback' => array( __CLASS__, 'sanitize_poi_type' ),
        ) );

        foreach ( array( 'latitude', 'longitude' ) as $field ) {
            register_post_meta( 'trail_poi', $field, $common + array(
                'type'              => 'number',
                'sanitize_callback' => array( __CLASS__, 'sanitize_float' ),
            ) );
        }

        register_post_meta( 'trail_poi', 'media_ids', array(
            'single'       => true,
            'show_in_rest' => array(
                'schema' => array(
                    'type'  => 'array',
                    'items' => array( 'type' => 'integer' ),
                ),
            ),
            'type'          => 'array',
            'auth_callback' => static fn() => current_user_can( 'edit_posts' ),
        ) );

        register_post_meta( 'trail_poi', 'external_video_url', $common + array(
            'type'              => 'string',
            'sanitize_callback' => 'esc_url_raw',
        ) );

        register_post_meta( 'trail_poi', 'submitted_by', $common + array(
            'type'              => 'integer',
            'sanitize_callback' => 'absint',
        ) );

        register_post_meta( 'trail_poi', 'verified_at', $common + array(
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
        ) );
    }

    public static function render_trail_meta_box( WP_Post $post ): void {
        wp_nonce_field( 'panachaiko_save_trail_meta', 'panachaiko_trail_meta_nonce' );

        $code         = (string) get_post_meta( $post->ID, 'trail_code', true );
        $stage        = (string) get_post_meta( $post->ID, 'trail_stage', true );
        $color        = (string) get_post_meta( $post->ID, 'trail_color', true );
        $length       = get_post_meta( $post->ID, 'length_km', true );
        $elev_min     = get_post_meta( $post->ID, 'elev_min', true );
        $elev_max     = get_post_meta( $post->ID, 'elev_max', true );
        $gain         = get_post_meta( $post->ID, 'gain_m', true );
        $loss         = get_post_meta( $post->ID, 'loss_m', true );
        $source       = (string) get_post_meta( $post->ID, 'data_source', true );
        $verified     = (string) get_post_meta( $post->ID, 'last_verified_at', true );
        $geometry     = (string) get_post_meta( $post->ID, 'geometry_json', true );

        if ( '' === $stage ) {
            $stage = 'planned';
        }
        if ( '' === $color ) {
            $color = '#84a06e';
        }
        ?>
        <style>
            .panachaiko-meta-grid{display:grid;grid-template-columns:repeat(2,minmax(220px,1fr));gap:16px 20px}.panachaiko-meta-grid .wide{grid-column:1/-1}.panachaiko-meta-grid label{display:block;font-weight:600;margin-bottom:6px}.panachaiko-meta-grid input,.panachaiko-meta-grid select,.panachaiko-meta-grid textarea{width:100%}.panachaiko-meta-help{color:#646970;margin:6px 0 0}.panachaiko-geometry{font-family:monospace;font-size:12px;min-height:120px}
            @media(max-width:782px){.panachaiko-meta-grid{grid-template-columns:1fr}}
        </style>
        <div class="panachaiko-meta-grid">
            <div>
                <label for="panachaiko_trail_code">Κωδικός διαδρομής</label>
                <input id="panachaiko_trail_code" name="panachaiko_trail_code" type="text" value="<?php echo esc_attr( $code ); ?>" placeholder="π.χ. Π-8" />
            </div>
            <div>
                <label for="panachaiko_trail_stage">Κατάσταση</label>
                <select id="panachaiko_trail_stage" name="panachaiko_trail_stage">
                    <option value="existing" <?php selected( $stage, 'existing' ); ?>>Υπάρχει</option>
                    <option value="planned" <?php selected( $stage, 'planned' ); ?>>Σχεδιάζεται</option>
                    <option value="investigation" <?php selected( $stage, 'investigation' ); ?>>Υπό διερεύνηση</option>
                </select>
            </div>
            <div>
                <label for="panachaiko_trail_color">Χρώμα</label>
                <input id="panachaiko_trail_color" name="panachaiko_trail_color" type="color" value="<?php echo esc_attr( $color ); ?>" />
            </div>
            <div>
                <label for="panachaiko_length_km">Μήκος (χλμ)</label>
                <input id="panachaiko_length_km" name="panachaiko_length_km" type="number" step="0.01" min="0" value="<?php echo esc_attr( $length ); ?>" />
            </div>
            <div>
                <label for="panachaiko_elev_min">Ελάχιστο υψόμετρο (μ)</label>
                <input id="panachaiko_elev_min" name="panachaiko_elev_min" type="number" step="1" value="<?php echo esc_attr( $elev_min ); ?>" />
            </div>
            <div>
                <label for="panachaiko_elev_max">Μέγιστο υψόμετρο (μ)</label>
                <input id="panachaiko_elev_max" name="panachaiko_elev_max" type="number" step="1" value="<?php echo esc_attr( $elev_max ); ?>" />
            </div>
            <div>
                <label for="panachaiko_gain_m">Ανάβαση (μ)</label>
                <input id="panachaiko_gain_m" name="panachaiko_gain_m" type="number" step="1" min="0" value="<?php echo esc_attr( $gain ); ?>" />
            </div>
            <div>
                <label for="panachaiko_loss_m">Κατάβαση (μ)</label>
                <input id="panachaiko_loss_m" name="panachaiko_loss_m" type="number" step="1" min="0" value="<?php echo esc_attr( $loss ); ?>" />
            </div>
            <div>
                <label for="panachaiko_data_source">Πηγή δεδομένων</label>
                <input id="panachaiko_data_source" name="panachaiko_data_source" type="text" value="<?php echo esc_attr( $source ); ?>" placeholder="ΟΦΥΠΕΚΑ" />
            </div>
            <div>
                <label for="panachaiko_last_verified_at">Τελευταία επαλήθευση</label>
                <input id="panachaiko_last_verified_at" name="panachaiko_last_verified_at" type="date" value="<?php echo esc_attr( $verified ); ?>" />
            </div>
            <div class="wide">
                <label>Γεωμετρία διαδρομής (GeoJSON MultiLineString)</label>
                <textarea class="panachaiko-geometry" readonly><?php echo esc_textarea( $geometry ); ?></textarea>
                <p class="panachaiko-meta-help">Η γεωμετρία προστατεύεται από τυχαία επεξεργασία. Αλλάζει μέσω import ή εργαλείου χαρτογράφησης.</p>
            </div>
        </div>
        <?php
    }

    public static function render_poi_meta_box( WP_Post $post ): void {
        wp_nonce_field( 'panachaiko_save_poi_meta', 'panachaiko_poi_meta_nonce' );

        $related  = absint( get_post_meta( $post->ID, 'related_trail', true ) );
        $type     = (string) get_post_meta( $post->ID, 'poi_type', true );
        $lat      = get_post_meta( $post->ID, 'latitude', true );
        $lng      = get_post_meta( $post->ID, 'longitude', true );
        $video    = (string) get_post_meta( $post->ID, 'external_video_url', true );
        $verified = (string) get_post_meta( $post->ID, 'verified_at', true );
        $trails   = get_posts( array(
            'post_type'      => 'trail',
            'post_status'    => 'publish',
            'posts_per_page' => -1,
            'orderby'        => 'title',
            'order'          => 'ASC',
        ) );

        if ( '' === $type ) {
            $type = 'general';
        }
        ?>
        <div class="panachaiko-meta-grid">
            <div class="wide">
                <label for="panachaiko_related_trail">Σχετική διαδρομή</label>
                <select id="panachaiko_related_trail" name="panachaiko_related_trail">
                    <option value="0">— Χωρίς συσχέτιση —</option>
                    <?php foreach ( $trails as $trail ) : ?>
                        <?php $trail_code = (string) get_post_meta( $trail->ID, 'trail_code', true ); ?>
                        <option value="<?php echo esc_attr( $trail->ID ); ?>" <?php selected( $related, $trail->ID ); ?>><?php echo esc_html( trim( $trail_code . ' — ' . $trail->post_title, ' —' ) ); ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div>
                <label for="panachaiko_poi_type">Τύπος σημείου</label>
                <select id="panachaiko_poi_type" name="panachaiko_poi_type">
                    <?php
                    $types = array(
                        'note'      => 'Ένδειξη',
                        'shelter'   => 'Καταφύγιο',
                        'hazard'    => 'Κίνδυνος',
                        'water'     => 'Νερό',
                        'viewpoint' => 'Θέα',
                        'photo'     => 'Φωτογραφία',
                        'video'     => 'Βίντεο',
                        'general'   => 'Γενικό',
                    );
                    foreach ( $types as $value => $label ) :
                        ?>
                        <option value="<?php echo esc_attr( $value ); ?>" <?php selected( $type, $value ); ?>><?php echo esc_html( $label ); ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div>
                <label for="panachaiko_verified_at">Επαληθεύτηκε</label>
                <input id="panachaiko_verified_at" name="panachaiko_verified_at" type="date" value="<?php echo esc_attr( $verified ); ?>" />
            </div>
            <div>
                <label for="panachaiko_latitude">Γεωγραφικό πλάτος (lat)</label>
                <input id="panachaiko_latitude" name="panachaiko_latitude" type="number" step="0.000001" value="<?php echo esc_attr( $lat ); ?>" />
            </div>
            <div>
                <label for="panachaiko_longitude">Γεωγραφικό μήκος (lng)</label>
                <input id="panachaiko_longitude" name="panachaiko_longitude" type="number" step="0.000001" value="<?php echo esc_attr( $lng ); ?>" />
            </div>
            <div class="wide">
                <label for="panachaiko_external_video_url">Εξωτερικό URL βίντεο</label>
                <input id="panachaiko_external_video_url" name="panachaiko_external_video_url" type="url" value="<?php echo esc_attr( $video ); ?>" placeholder="https://..." />
                <p class="panachaiko-meta-help">Για φωτογραφία μπορείς να χρησιμοποιήσεις την «Εικόνα άρθρου» του WordPress.</p>
            </div>
        </div>
        <?php
    }

    public static function save_trail_meta( int $post_id ): void {
        if ( ! self::can_save( $post_id, 'panachaiko_trail_meta_nonce', 'panachaiko_save_trail_meta' ) ) {
            return;
        }

        self::save_text( $post_id, 'trail_code', 'panachaiko_trail_code' );
        self::save_stage( $post_id );
        self::save_color( $post_id );
        self::save_number( $post_id, 'length_km', 'panachaiko_length_km' );
        self::save_number( $post_id, 'elev_min', 'panachaiko_elev_min' );
        self::save_number( $post_id, 'elev_max', 'panachaiko_elev_max' );
        self::save_number( $post_id, 'gain_m', 'panachaiko_gain_m' );
        self::save_number( $post_id, 'loss_m', 'panachaiko_loss_m' );
        self::save_text( $post_id, 'data_source', 'panachaiko_data_source' );
        self::save_text( $post_id, 'last_verified_at', 'panachaiko_last_verified_at' );
    }

    public static function save_poi_meta( int $post_id ): void {
        if ( ! self::can_save( $post_id, 'panachaiko_poi_meta_nonce', 'panachaiko_save_poi_meta' ) ) {
            return;
        }

        update_post_meta( $post_id, 'related_trail', isset( $_POST['panachaiko_related_trail'] ) ? absint( $_POST['panachaiko_related_trail'] ) : 0 );

        $type = isset( $_POST['panachaiko_poi_type'] ) ? self::sanitize_poi_type( sanitize_text_field( wp_unslash( $_POST['panachaiko_poi_type'] ) ) ) : 'general';
        update_post_meta( $post_id, 'poi_type', $type );

        self::save_number( $post_id, 'latitude', 'panachaiko_latitude' );
        self::save_number( $post_id, 'longitude', 'panachaiko_longitude' );

        if ( isset( $_POST['panachaiko_external_video_url'] ) ) {
            $url = esc_url_raw( wp_unslash( $_POST['panachaiko_external_video_url'] ) );
            if ( '' === $url ) {
                delete_post_meta( $post_id, 'external_video_url' );
            } else {
                update_post_meta( $post_id, 'external_video_url', $url );
            }
        }

        self::save_text( $post_id, 'verified_at', 'panachaiko_verified_at' );
    }

    private static function can_save( int $post_id, string $nonce_field, string $nonce_action ): bool {
        if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
            return false;
        }
        if ( wp_is_post_revision( $post_id ) ) {
            return false;
        }
        if ( ! isset( $_POST[ $nonce_field ] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST[ $nonce_field ] ) ), $nonce_action ) ) {
            return false;
        }
        return current_user_can( 'edit_post', $post_id );
    }

    private static function save_text( int $post_id, string $meta_key, string $field_name ): void {
        if ( ! isset( $_POST[ $field_name ] ) ) {
            return;
        }
        $value = sanitize_text_field( wp_unslash( $_POST[ $field_name ] ) );
        if ( '' === $value ) {
            delete_post_meta( $post_id, $meta_key );
        } else {
            update_post_meta( $post_id, $meta_key, $value );
        }
    }

    private static function save_number( int $post_id, string $meta_key, string $field_name ): void {
        if ( ! isset( $_POST[ $field_name ] ) ) {
            return;
        }
        $raw = wp_unslash( $_POST[ $field_name ] );
        if ( '' === $raw || ! is_numeric( $raw ) ) {
            delete_post_meta( $post_id, $meta_key );
            return;
        }
        update_post_meta( $post_id, $meta_key, (float) $raw );
    }

    private static function save_stage( int $post_id ): void {
        $value = isset( $_POST['panachaiko_trail_stage'] ) ? sanitize_text_field( wp_unslash( $_POST['panachaiko_trail_stage'] ) ) : 'planned';
        update_post_meta( $post_id, 'trail_stage', self::sanitize_trail_stage( $value ) );
    }

    private static function save_color( int $post_id ): void {
        $value = isset( $_POST['panachaiko_trail_color'] ) ? sanitize_hex_color( wp_unslash( $_POST['panachaiko_trail_color'] ) ) : '';
        update_post_meta( $post_id, 'trail_color', $value ?: '#84a06e' );
    }

    public static function sanitize_trail_stage( $value ): string {
        $allowed = array( 'existing', 'planned', 'investigation' );
        return in_array( $value, $allowed, true ) ? $value : 'planned';
    }

    public static function sanitize_poi_type( $value ): string {
        $allowed = array( 'note', 'shelter', 'hazard', 'water', 'viewpoint', 'photo', 'video', 'general' );
        return in_array( $value, $allowed, true ) ? $value : 'general';
    }

    public static function sanitize_number_or_null( $value ) {
        if ( null === $value || '' === $value ) {
            return null;
        }
        return is_numeric( $value ) ? (float) $value : null;
    }

    public static function sanitize_float( $value ): float {
        return is_numeric( $value ) ? (float) $value : 0.0;
    }

    public static function sanitize_geometry_json( $value ): string {
        if ( ! is_string( $value ) ) {
            return '';
        }

        $decoded = json_decode( $value, true );
        if ( ! is_array( $decoded ) || 'MultiLineString' !== ( $decoded['type'] ?? null ) || ! isset( $decoded['coordinates'] ) || ! is_array( $decoded['coordinates'] ) ) {
            return '';
        }

        return wp_json_encode( $decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
    }
}
