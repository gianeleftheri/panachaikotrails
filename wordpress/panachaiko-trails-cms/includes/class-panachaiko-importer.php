<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

final class Panachaiko_Trails_Importer {
    public static function init(): void {
        add_action( 'admin_menu', array( __CLASS__, 'register_page' ) );
        add_action( 'admin_post_panachaiko_import_trails', array( __CLASS__, 'handle_import' ) );
        add_action( 'admin_post_panachaiko_import_bundled_trails', array( __CLASS__, 'handle_bundled_import' ) );
    }

    public static function register_page(): void {
        add_management_page(
            'Panachaiko Trails Import',
            'Panachaiko Trails Import',
            'manage_options',
            'panachaiko-trails-import',
            array( __CLASS__, 'render_page' )
        );
    }

    public static function render_page(): void {
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }

        $result = isset( $_GET['panachaiko_import'] ) ? sanitize_text_field( wp_unslash( $_GET['panachaiko_import'] ) ) : '';
        $count  = isset( $_GET['count'] ) ? absint( $_GET['count'] ) : 0;
        ?>
        <div class="wrap">
            <h1>Panachaiko Trails — Import</h1>

            <?php if ( 'success' === $result ) : ?>
                <div class="notice notice-success"><p><?php echo esc_html( sprintf( 'Ολοκληρώθηκε η εισαγωγή %d διαδρομών.', $count ) ); ?></p></div>
            <?php elseif ( 'error' === $result ) : ?>
                <div class="notice notice-error"><p>Η εισαγωγή απέτυχε. Έλεγξε τα δεδομένα και δοκίμασε ξανά.</p></div>
            <?php endif; ?>

            <h2>Γρήγορη εισαγωγή</h2>
            <p>Οι 13 υπάρχουσες διαδρομές περιλαμβάνονται ήδη στο plugin. Πάτησε μόνο το παρακάτω κουμπί.</p>
            <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
                <input type="hidden" name="action" value="panachaiko_import_bundled_trails" />
                <?php wp_nonce_field( 'panachaiko_import_bundled_trails' ); ?>
                <?php submit_button( 'Εισαγωγή των 13 διαδρομών', 'primary', 'submit', false ); ?>
            </form>

            <hr style="margin:30px 0;" />

            <h2>Χειροκίνητη εισαγωγή JSON</h2>
            <p>Εναλλακτικά μπορείς να επιλέξεις ένα ή περισσότερα JSON αρχεία. Ο importer δημιουργεί ή ενημερώνει διαδρομές με βάση το μοναδικό <code>trail_code</code>.</p>
            <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" enctype="multipart/form-data">
                <input type="hidden" name="action" value="panachaiko_import_trails" />
                <?php wp_nonce_field( 'panachaiko_import_trails' ); ?>
                <p><input type="file" name="trail_files[]" accept="application/json,.json" multiple required /></p>
                <?php submit_button( 'Εισαγωγή επιλεγμένων αρχείων' ); ?>
            </form>
        </div>
        <?php
    }

    public static function handle_bundled_import(): void {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( 'Unauthorized.' );
        }

        check_admin_referer( 'panachaiko_import_bundled_trails' );

        $files = glob( PANACHAIKO_TRAILS_DIR . 'data/*.json' );
        if ( ! is_array( $files ) || empty( $files ) ) {
            self::redirect( 'error', 0 );
        }

        sort( $files, SORT_STRING );
        $count = 0;

        foreach ( $files as $file ) {
            $raw = file_get_contents( $file );
            if ( false === $raw ) {
                continue;
            }

            $data = json_decode( $raw, true );
            if ( ! is_array( $data ) || ! self::import_one( $data ) ) {
                continue;
            }

            ++$count;
        }

        self::redirect( $count > 0 ? 'success' : 'error', $count );
    }

    public static function handle_import(): void {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( 'Unauthorized.' );
        }

        check_admin_referer( 'panachaiko_import_trails' );

        if ( empty( $_FILES['trail_files'] ) || ! is_array( $_FILES['trail_files']['name'] ?? null ) ) {
            self::redirect( 'error', 0 );
        }

        $files = $_FILES['trail_files'];
        $count = 0;

        foreach ( $files['name'] as $index => $name ) {
            if ( UPLOAD_ERR_OK !== (int) $files['error'][ $index ] ) {
                continue;
            }

            $tmp = $files['tmp_name'][ $index ];
            if ( ! is_uploaded_file( $tmp ) ) {
                continue;
            }

            $raw = file_get_contents( $tmp );
            if ( false === $raw ) {
                continue;
            }

            $data = json_decode( $raw, true );
            if ( ! is_array( $data ) || ! self::import_one( $data ) ) {
                continue;
            }

            ++$count;
        }

        self::redirect( $count > 0 ? 'success' : 'error', $count );
    }

    private static function import_one( array $data ): bool {
        $code  = sanitize_text_field( (string) ( $data['key'] ?? '' ) );
        $trail = $data['trail'] ?? null;
        if ( '' === $code || ! is_array( $trail ) ) {
            return false;
        }

        $existing = get_posts(
            array(
                'post_type'      => 'trail',
                'post_status'    => 'any',
                'posts_per_page' => 1,
                'meta_key'       => 'trail_code',
                'meta_value'     => $code,
                'fields'         => 'ids',
            )
        );

        $postarr = array(
            'post_type'   => 'trail',
            'post_status' => 'publish',
            'post_title'  => sanitize_text_field( (string) ( $trail['name'] ?? $code ) ),
        );

        if ( $existing ) {
            $postarr['ID'] = (int) $existing[0];
        }

        $post_id = wp_insert_post( $postarr, true );
        if ( is_wp_error( $post_id ) ) {
            return false;
        }

        $stage = self::infer_stage( $trail );
        update_post_meta( $post_id, 'trail_code', $code );
        update_post_meta( $post_id, 'trail_stage', $stage );
        update_post_meta( $post_id, 'trail_color', sanitize_hex_color( (string) ( $trail['color'] ?? '#84a06e' ) ) ?: '#84a06e' );
        update_post_meta( $post_id, 'length_km', self::numeric_or_zero( $trail['length_km'] ?? 0 ) );
        self::update_nullable_number( $post_id, 'elev_min', $trail['elev_min'] ?? null );
        self::update_nullable_number( $post_id, 'elev_max', $trail['elev_max'] ?? null );
        update_post_meta( $post_id, 'gain_m', self::numeric_or_zero( $trail['gain_m'] ?? 0 ) );
        update_post_meta( $post_id, 'loss_m', self::numeric_or_zero( $trail['loss_m'] ?? 0 ) );
        update_post_meta( $post_id, 'data_source', 'ΟΦΥΠΕΚΑ' );

        $segments = is_array( $trail['segments'] ?? null ) ? $trail['segments'] : array();
        update_post_meta(
            $post_id,
            'geometry_json',
            wp_json_encode(
                array(
                    'type'        => 'MultiLineString',
                    'coordinates' => $segments,
                ),
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
            )
        );

        self::import_legacy_notes( $post_id, $trail['notes'] ?? array() );
        return true;
    }

    private static function infer_stage( array $trail ): string {
        $name = mb_strtolower( (string) ( $trail['name'] ?? '' ), 'UTF-8' );
        if ( false !== mb_strpos( $name, 'υπό διερεύνηση', 0, 'UTF-8' ) ) {
            return 'investigation';
        }
        return ! empty( $trail['existing'] ) ? 'existing' : 'planned';
    }

    private static function import_legacy_notes( int $trail_id, $notes ): void {
        if ( ! is_array( $notes ) ) {
            return;
        }

        foreach ( $notes as $note ) {
            if ( ! is_array( $note ) ) {
                continue;
            }

            $title = sanitize_text_field( (string) ( $note['title'] ?? 'Σημείο διαδρομής' ) );
            $text  = sanitize_textarea_field( (string) ( $note['text'] ?? '' ) );
            $lat   = $note['lat'] ?? null;
            $lng   = $note['lng'] ?? null;

            if ( ! is_numeric( $lat ) || ! is_numeric( $lng ) ) {
                continue;
            }

            $existing = get_posts(
                array(
                    'post_type'      => 'trail_poi',
                    'post_status'    => 'any',
                    'posts_per_page' => 1,
                    'meta_query'     => array(
                        array( 'key' => 'related_trail', 'value' => $trail_id ),
                        array( 'key' => 'latitude', 'value' => (float) $lat ),
                        array( 'key' => 'longitude', 'value' => (float) $lng ),
                    ),
                    'fields' => 'ids',
                )
            );

            $poi_post = array(
                'post_type'    => 'trail_poi',
                'post_status'  => 'publish',
                'post_title'   => $title,
                'post_content' => $text,
            );
            if ( $existing ) {
                $poi_post['ID'] = (int) $existing[0];
            }

            $poi_id = wp_insert_post( $poi_post, true );
            if ( is_wp_error( $poi_id ) ) {
                continue;
            }

            update_post_meta( $poi_id, 'related_trail', $trail_id );
            update_post_meta( $poi_id, 'poi_type', sanitize_text_field( (string) ( $note['category'] ?? 'note' ) ) );
            update_post_meta( $poi_id, 'latitude', (float) $lat );
            update_post_meta( $poi_id, 'longitude', (float) $lng );
        }
    }

    private static function numeric_or_zero( $value ): float {
        return is_numeric( $value ) ? (float) $value : 0.0;
    }

    private static function update_nullable_number( int $post_id, string $key, $value ): void {
        if ( is_numeric( $value ) ) {
            update_post_meta( $post_id, $key, (float) $value );
        } else {
            delete_post_meta( $post_id, $key );
        }
    }

    private static function redirect( string $status, int $count ): void {
        wp_safe_redirect(
            add_query_arg(
                array(
                    'page'              => 'panachaiko-trails-import',
                    'panachaiko_import' => $status,
                    'count'             => $count,
                ),
                admin_url( 'tools.php' )
            )
        );
        exit;
    }
}
