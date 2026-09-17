<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

final class Panachaiko_Trails_REST {
    public static function init(): void {
        add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
    }

    public static function register_routes(): void {
        register_rest_route( 'panachaiko/v1', '/trails', array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => array( __CLASS__, 'get_trails' ),
            'permission_callback' => '__return_true',
        ) );

        register_rest_route( 'panachaiko/v1', '/trails/(?P<code>[^/]+)', array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => array( __CLASS__, 'get_trail' ),
            'permission_callback' => '__return_true',
            'args' => array( 'code' => array( 'required' => true, 'sanitize_callback' => 'sanitize_text_field' ) ),
        ) );

        register_rest_route( 'panachaiko/v1', '/submissions', array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => array( __CLASS__, 'create_submission' ),
            'permission_callback' => '__return_true',
        ) );
    }

    public static function get_trails( WP_REST_Request $request ): WP_REST_Response {
        $posts = get_posts( array( 'post_type' => 'trail', 'post_status' => 'publish', 'posts_per_page' => -1, 'orderby' => 'title', 'order' => 'ASC' ) );
        return rest_ensure_response( array_map( array( __CLASS__, 'format_trail' ), $posts ) );
    }

    public static function get_trail( WP_REST_Request $request ) {
        $code = rawurldecode( (string) $request['code'] );
        $posts = get_posts( array( 'post_type' => 'trail', 'post_status' => 'publish', 'posts_per_page' => 1, 'meta_key' => 'trail_code', 'meta_value' => $code ) );
        if ( ! $posts ) return new WP_Error( 'panachaiko_trail_not_found', 'Trail not found.', array( 'status' => 404 ) );
        return rest_ensure_response( self::format_trail( $posts[0] ) );
    }

    public static function create_submission( WP_REST_Request $request ) {
        if ( '' !== trim( (string) $request->get_param( 'website' ) ) ) {
            return new WP_Error( 'panachaiko_spam', 'Submission rejected.', array( 'status' => 400 ) );
        }

        $rate_key = 'panachaiko_submit_' . md5( (string) ( $_SERVER['REMOTE_ADDR'] ?? 'unknown' ) );
        $count = (int) get_transient( $rate_key );
        if ( $count >= 12 ) {
            return new WP_Error( 'panachaiko_rate_limit', 'Πολλές υποβολές σε σύντομο χρόνο. Δοκίμασε ξανά αργότερα.', array( 'status' => 429 ) );
        }
        set_transient( $rate_key, $count + 1, HOUR_IN_SECONDS );

        $trail_code = sanitize_text_field( (string) $request->get_param( 'trail_code' ) );
        $content_type = Panachaiko_Trails_Meta::sanitize_content_type( sanitize_text_field( (string) $request->get_param( 'content_type' ) ) );
        $category = Panachaiko_Trails_Meta::sanitize_poi_type( sanitize_text_field( (string) $request->get_param( 'category' ) ) );
        $title = sanitize_text_field( (string) $request->get_param( 'title' ) );
        $text = sanitize_textarea_field( (string) $request->get_param( 'text' ) );
        $video_url = esc_url_raw( (string) $request->get_param( 'video_url' ) );
        $lat = $request->get_param( 'lat' );
        $lng = $request->get_param( 'lng' );

        if ( '' === $trail_code || ! is_numeric( $lat ) || ! is_numeric( $lng ) ) {
            return new WP_Error( 'panachaiko_invalid_submission', 'Λείπουν βασικά στοιχεία της υποβολής.', array( 'status' => 400 ) );
        }
        $lat = (float) $lat; $lng = (float) $lng;
        if ( $lat < -90 || $lat > 90 || $lng < -180 || $lng > 180 ) {
            return new WP_Error( 'panachaiko_invalid_coordinates', 'Μη έγκυρες συντεταγμένες.', array( 'status' => 400 ) );
        }

        $trails = get_posts( array( 'post_type' => 'trail', 'post_status' => 'publish', 'posts_per_page' => 1, 'meta_key' => 'trail_code', 'meta_value' => $trail_code, 'fields' => 'ids' ) );
        if ( ! $trails ) {
            return new WP_Error( 'panachaiko_trail_not_found', 'Η διαδρομή δεν βρέθηκε.', array( 'status' => 404 ) );
        }

        if ( 'note' === $content_type && '' === trim( $text ) ) {
            return new WP_Error( 'panachaiko_note_required', 'Γράψε μια περιγραφή για το σημείο.', array( 'status' => 400 ) );
        }
        if ( 'video' === $content_type && '' !== $video_url && ! self::allowed_video_url( $video_url ) ) {
            return new WP_Error( 'panachaiko_video_url', 'Επιτρέπονται σύνδεσμοι YouTube ή Vimeo.', array( 'status' => 400 ) );
        }

        $post_id = wp_insert_post( array(
            'post_type' => 'trail_poi',
            'post_status' => 'pending',
            'post_title' => $title ?: self::default_submission_title( $content_type, $category ),
            'post_content' => $text,
        ), true );
        if ( is_wp_error( $post_id ) ) return $post_id;

        update_post_meta( $post_id, 'related_trail', (int) $trails[0] );
        update_post_meta( $post_id, 'content_type', $content_type );
        update_post_meta( $post_id, 'poi_type', $category );
        update_post_meta( $post_id, 'latitude', $lat );
        update_post_meta( $post_id, 'longitude', $lng );
        if ( $video_url ) update_post_meta( $post_id, 'external_video_url', $video_url );

        $files = $request->get_file_params();
        if ( isset( $files['file'] ) && is_array( $files['file'] ) && ! empty( $files['file']['name'] ) ) {
            $file = $files['file'];
            $max_size = 'photo' === $content_type ? 10 * MB_IN_BYTES : 50 * MB_IN_BYTES;
            if ( (int) ( $file['size'] ?? 0 ) > $max_size ) {
                wp_delete_post( $post_id, true );
                return new WP_Error( 'panachaiko_file_too_large', 'Το αρχείο είναι μεγαλύτερο από το επιτρεπόμενο όριο.', array( 'status' => 413 ) );
            }
            $allowed = 'photo' === $content_type
                ? array( 'jpg|jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'gif' => 'image/gif' )
                : array( 'mp4' => 'video/mp4', 'webm' => 'video/webm', 'mov|qt' => 'video/quicktime' );
            $checked = wp_check_filetype_and_ext( $file['tmp_name'], $file['name'], $allowed );
            if ( empty( $checked['type'] ) ) {
                wp_delete_post( $post_id, true );
                return new WP_Error( 'panachaiko_file_type', 'Ο τύπος του αρχείου δεν επιτρέπεται.', array( 'status' => 415 ) );
            }
            require_once ABSPATH . 'wp-admin/includes/file.php';
            require_once ABSPATH . 'wp-admin/includes/media.php';
            require_once ABSPATH . 'wp-admin/includes/image.php';
            $attachment_id = media_handle_sideload( $file, $post_id );
            if ( is_wp_error( $attachment_id ) ) {
                wp_delete_post( $post_id, true );
                return new WP_Error( 'panachaiko_upload_failed', 'Το αρχείο δεν αποθηκεύτηκε.', array( 'status' => 500 ) );
            }
            update_post_meta( $post_id, 'media_ids', array( (int) $attachment_id ) );
            if ( 'photo' === $content_type ) set_post_thumbnail( $post_id, (int) $attachment_id );
        } elseif ( 'photo' === $content_type ) {
            wp_delete_post( $post_id, true );
            return new WP_Error( 'panachaiko_photo_required', 'Επίλεξε φωτογραφία.', array( 'status' => 400 ) );
        } elseif ( 'video' === $content_type && '' === $video_url ) {
            wp_delete_post( $post_id, true );
            return new WP_Error( 'panachaiko_video_required', 'Επίλεξε αρχείο βίντεο ή σύνδεσμο YouTube/Vimeo.', array( 'status' => 400 ) );
        }

        return new WP_REST_Response( array( 'ok' => true, 'id' => $post_id, 'status' => 'pending', 'message' => 'Η υποβολή αποθηκεύτηκε και περιμένει έγκριση.' ), 201 );
    }

    private static function allowed_video_url( string $url ): bool {
        $host = strtolower( (string) wp_parse_url( $url, PHP_URL_HOST ) );
        return in_array( $host, array( 'youtube.com','www.youtube.com','youtu.be','vimeo.com','www.vimeo.com','player.vimeo.com' ), true );
    }

    private static function default_submission_title( string $content_type, string $category ): string {
        $base = array( 'photo' => 'Φωτογραφία', 'video' => 'Βίντεο', 'note' => 'Περιγραφή' );
        return ( $base[ $content_type ] ?? 'Σημείο' ) . ' — ' . $category;
    }

    private static function format_trail( WP_Post $post ): array {
        $code = (string) get_post_meta( $post->ID, 'trail_code', true );
        $stage = (string) get_post_meta( $post->ID, 'trail_stage', true );
        $geometry = self::decode_geometry( (string) get_post_meta( $post->ID, 'geometry_json', true ) );
        $pois = self::get_pois_for_trail( $post->ID );
        $notes = array_values( array_filter( $pois, static fn( array $poi ): bool => 'note' === $poi['content_type'] ) );
        $photos = array_values( array_filter( $pois, static fn( array $poi ): bool => 'photo' === $poi['content_type'] ) );
        $videos = array_values( array_filter( $pois, static fn( array $poi ): bool => 'video' === $poi['content_type'] ) );

        return array( 'key' => $code, 'trail' => array(
            'id' => $post->ID,
            'name' => get_the_title( $post ),
            'description' => apply_filters( 'the_content', $post->post_content ),
            'status' => $stage ?: 'planned',
            'existing' => 'existing' === $stage,
            'color' => (string) get_post_meta( $post->ID, 'trail_color', true ),
            'length_km' => self::meta_number( $post->ID, 'length_km', 0.0 ),
            'elev_min' => self::meta_nullable_number( $post->ID, 'elev_min' ),
            'elev_max' => self::meta_nullable_number( $post->ID, 'elev_max' ),
            'gain_m' => self::meta_number( $post->ID, 'gain_m', 0.0 ),
            'loss_m' => self::meta_number( $post->ID, 'loss_m', 0.0 ),
            'segments' => $geometry['coordinates'] ?? array(),
            'photos' => $photos,
            'videos' => $videos,
            'notes' => $notes,
            'source' => (string) get_post_meta( $post->ID, 'data_source', true ),
            'verified_at' => (string) get_post_meta( $post->ID, 'last_verified_at', true ),
        ) );
    }

    private static function get_pois_for_trail( int $trail_id ): array {
        $posts = get_posts( array( 'post_type' => 'trail_poi', 'post_status' => 'publish', 'posts_per_page' => -1, 'meta_key' => 'related_trail', 'meta_value' => $trail_id, 'orderby' => 'menu_order title', 'order' => 'ASC' ) );
        return array_map( static function ( WP_Post $poi ): array {
            $category = (string) get_post_meta( $poi->ID, 'poi_type', true );
            $content_type = (string) get_post_meta( $poi->ID, 'content_type', true );
            if ( '' === $content_type ) $content_type = in_array( $category, array( 'photo','video' ), true ) ? $category : 'note';
            $media_ids = array_values( array_filter( array_map( 'absint', (array) get_post_meta( $poi->ID, 'media_ids', true ) ) ) );
            $media_urls = array_values( array_filter( array_map( static function ( int $attachment_id ): string { $url = wp_get_attachment_url( $attachment_id ); return is_string( $url ) ? $url : ''; }, $media_ids ) ) );
            $featured = get_the_post_thumbnail_url( $poi, 'large' );
            return array(
                'id' => $poi->ID,
                'title' => get_the_title( $poi ),
                'text' => wp_strip_all_tags( $poi->post_content ),
                'content_type' => $content_type,
                'category' => $category ?: 'general',
                'lat' => self::nullable_float_meta( $poi->ID, 'latitude' ),
                'lng' => self::nullable_float_meta( $poi->ID, 'longitude' ),
                'media_ids' => $media_ids,
                'media_urls' => $media_urls,
                'featured_image_url' => is_string( $featured ) ? $featured : null,
                'video_url' => (string) get_post_meta( $poi->ID, 'external_video_url', true ),
                'verified_at' => (string) get_post_meta( $poi->ID, 'verified_at', true ),
            );
        }, $posts );
    }

    private static function decode_geometry( string $json ): array { if ( '' === $json ) return array( 'type'=>'MultiLineString','coordinates'=>array() ); $decoded = json_decode( $json, true ); if ( ! is_array( $decoded ) || 'MultiLineString' !== ( $decoded['type'] ?? null ) || ! is_array( $decoded['coordinates'] ?? null ) ) return array( 'type'=>'MultiLineString','coordinates'=>array() ); return $decoded; }
    private static function nullable_float_meta( int $post_id, string $key ) { $value = get_post_meta( $post_id, $key, true ); return is_numeric( $value ) ? (float) $value : null; }
    private static function meta_number( int $post_id, string $key, float $default ): float { $value = get_post_meta( $post_id, $key, true ); return is_numeric( $value ) ? (float) $value : $default; }
    private static function meta_nullable_number( int $post_id, string $key ) { $value = get_post_meta( $post_id, $key, true ); return is_numeric( $value ) ? (float) $value : null; }
}
