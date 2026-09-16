<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

final class Panachaiko_Trails_REST {
    public static function init(): void {
        add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
    }

    public static function register_routes(): void {
        register_rest_route(
            'panachaiko/v1',
            '/trails',
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array( __CLASS__, 'get_trails' ),
                'permission_callback' => '__return_true',
            )
        );

        register_rest_route(
            'panachaiko/v1',
            '/trails/(?P<code>[^/]+)',
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array( __CLASS__, 'get_trail' ),
                'permission_callback' => '__return_true',
                'args'                => array(
                    'code' => array(
                        'required'          => true,
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                ),
            )
        );
    }

    public static function get_trails( WP_REST_Request $request ): WP_REST_Response {
        $posts = get_posts(
            array(
                'post_type'      => 'trail',
                'post_status'    => 'publish',
                'posts_per_page' => -1,
                'orderby'        => 'title',
                'order'          => 'ASC',
            )
        );

        $items = array_map( array( __CLASS__, 'format_trail' ), $posts );
        return rest_ensure_response( $items );
    }

    public static function get_trail( WP_REST_Request $request ) {
        $code = rawurldecode( (string) $request['code'] );
        $posts = get_posts(
            array(
                'post_type'      => 'trail',
                'post_status'    => 'publish',
                'posts_per_page' => 1,
                'meta_key'       => 'trail_code',
                'meta_value'     => $code,
            )
        );

        if ( ! $posts ) {
            return new WP_Error( 'panachaiko_trail_not_found', 'Trail not found.', array( 'status' => 404 ) );
        }

        return rest_ensure_response( self::format_trail( $posts[0] ) );
    }

    private static function format_trail( WP_Post $post ): array {
        $code  = (string) get_post_meta( $post->ID, 'trail_code', true );
        $stage = (string) get_post_meta( $post->ID, 'trail_stage', true );
        $geometry = self::decode_geometry( (string) get_post_meta( $post->ID, 'geometry_json', true ) );
        $pois = self::get_pois_for_trail( $post->ID );

        $notes  = array_values( array_filter( $pois, static fn( array $poi ): bool => ! in_array( $poi['category'], array( 'photo', 'video' ), true ) ) );
        $photos = array_values( array_filter( $pois, static fn( array $poi ): bool => 'photo' === $poi['category'] ) );
        $videos = array_values( array_filter( $pois, static fn( array $poi ): bool => 'video' === $poi['category'] ) );

        return array(
            'key'   => $code,
            'trail' => array(
                'id'          => $post->ID,
                'name'        => get_the_title( $post ),
                'description' => apply_filters( 'the_content', $post->post_content ),
                'status'      => $stage ?: 'planned',
                'existing'    => 'existing' === $stage,
                'color'       => (string) get_post_meta( $post->ID, 'trail_color', true ),
                'length_km'   => self::meta_number( $post->ID, 'length_km', 0.0 ),
                'elev_min'    => self::meta_nullable_number( $post->ID, 'elev_min' ),
                'elev_max'    => self::meta_nullable_number( $post->ID, 'elev_max' ),
                'gain_m'      => self::meta_number( $post->ID, 'gain_m', 0.0 ),
                'loss_m'      => self::meta_number( $post->ID, 'loss_m', 0.0 ),
                'segments'    => $geometry['coordinates'] ?? array(),
                'photos'      => $photos,
                'videos'      => $videos,
                'notes'       => $notes,
                'source'      => (string) get_post_meta( $post->ID, 'data_source', true ),
                'verified_at' => (string) get_post_meta( $post->ID, 'last_verified_at', true ),
            ),
        );
    }

    private static function get_pois_for_trail( int $trail_id ): array {
        $posts = get_posts(
            array(
                'post_type'      => 'trail_poi',
                'post_status'    => 'publish',
                'posts_per_page' => -1,
                'meta_key'       => 'related_trail',
                'meta_value'     => $trail_id,
                'orderby'        => 'menu_order title',
                'order'          => 'ASC',
            )
        );

        return array_map(
            static function ( WP_Post $poi ): array {
                return array(
                    'id'       => $poi->ID,
                    'title'    => get_the_title( $poi ),
                    'text'     => wp_strip_all_tags( $poi->post_content ),
                    'category' => (string) get_post_meta( $poi->ID, 'poi_type', true ),
                    'lat'      => (float) get_post_meta( $poi->ID, 'latitude', true ),
                    'lng'      => (float) get_post_meta( $poi->ID, 'longitude', true ),
                    'media_ids'=> array_map( 'absint', (array) get_post_meta( $poi->ID, 'media_ids', true ) ),
                    'video_url'=> (string) get_post_meta( $poi->ID, 'external_video_url', true ),
                );
            },
            $posts
        );
    }

    private static function decode_geometry( string $json ): array {
        if ( '' === $json ) {
            return array( 'type' => 'MultiLineString', 'coordinates' => array() );
        }

        $decoded = json_decode( $json, true );
        if ( ! is_array( $decoded ) || 'MultiLineString' !== ( $decoded['type'] ?? null ) || ! is_array( $decoded['coordinates'] ?? null ) ) {
            return array( 'type' => 'MultiLineString', 'coordinates' => array() );
        }

        return $decoded;
    }

    private static function meta_number( int $post_id, string $key, float $default ): float {
        $value = get_post_meta( $post_id, $key, true );
        return is_numeric( $value ) ? (float) $value : $default;
    }

    private static function meta_nullable_number( int $post_id, string $key ) {
        $value = get_post_meta( $post_id, $key, true );
        return is_numeric( $value ) ? (float) $value : null;
    }
}
