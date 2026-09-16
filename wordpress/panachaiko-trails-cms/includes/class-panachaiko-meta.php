<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

final class Panachaiko_Trails_Meta {
    public static function init(): void {
        add_action( 'init', array( __CLASS__, 'register' ) );
    }

    public static function register(): void {
        self::register_trail_meta();
        self::register_poi_meta();
    }

    private static function register_trail_meta(): void {
        $common = array(
            'single'       => true,
            'show_in_rest' => true,
            'auth_callback'=> static fn() => current_user_can( 'edit_posts' ),
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
            'single'       => true,
            'show_in_rest' => true,
            'auth_callback'=> static fn() => current_user_can( 'edit_posts' ),
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
