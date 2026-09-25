<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

final class Panachaiko_Site_Settings {
    private const OPTION_UNDER_CONSTRUCTION = 'panachaiko_under_construction';

    public static function init(): void {
        add_action( 'rest_api_init', array( __CLASS__, 'register_rest_routes' ) );
        add_action( 'admin_post_panachaiko_update_site_status', array( __CLASS__, 'handle_update' ) );
    }

    public static function is_under_construction(): bool {
        return '0' !== (string) get_option( self::OPTION_UNDER_CONSTRUCTION, '1' );
    }

    public static function register_rest_routes(): void {
        register_rest_route(
            'panachaiko/v1',
            '/site-status',
            array(
                'methods' => WP_REST_Server::READABLE,
                'callback' => array( __CLASS__, 'get_status' ),
                'permission_callback' => '__return_true',
            )
        );
    }

    public static function get_status( WP_REST_Request $request ): WP_REST_Response {
        $response = rest_ensure_response( array(
            'under_construction' => self::is_under_construction(),
        ) );
        $response->header( 'Cache-Control', 'no-store, max-age=0' );
        return $response;
    }

    public static function handle_update(): void {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'Δεν έχετε δικαίωμα να αλλάξετε αυτή τη ρύθμιση.', 'panachaiko-trails' ), '', array( 'response' => 403 ) );
        }

        check_admin_referer( 'panachaiko_update_site_status' );

        $enabled = isset( $_POST['under_construction'] ) && '1' === sanitize_key( wp_unslash( $_POST['under_construction'] ) );
        update_option( self::OPTION_UNDER_CONSTRUCTION, $enabled ? '1' : '0', false );

        $redirect = add_query_arg(
            array(
                'page' => 'panachaiko-trails-home',
                'site_status_updated' => '1',
            ),
            admin_url( 'admin.php' )
        );
        wp_safe_redirect( $redirect );
        exit;
    }
}
