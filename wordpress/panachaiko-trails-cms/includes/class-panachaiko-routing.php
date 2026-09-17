<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

final class Panachaiko_Trails_Routing {
    private const VALHALLA_URL = 'https://valhalla1.openstreetmap.de/route';

    public static function init(): void {
        add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
    }

    public static function register_routes(): void {
        register_rest_route( 'panachaiko/v1', '/route', array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => array( __CLASS__, 'route' ),
            'permission_callback' => '__return_true',
        ) );
    }

    public static function route( WP_REST_Request $request ) {
        $rate_key = 'panachaiko_route_' . md5( (string) ( $_SERVER['REMOTE_ADDR'] ?? 'unknown' ) );
        $count = (int) get_transient( $rate_key );
        if ( $count >= 60 ) {
            return new WP_Error( 'panachaiko_route_rate_limit', 'Πολλά αιτήματα διαδρομής. Δοκίμασε ξανά αργότερα.', array( 'status' => 429 ) );
        }
        set_transient( $rate_key, $count + 1, HOUR_IN_SECONDS );

        $start_lat = $request->get_param( 'start_lat' );
        $start_lng = $request->get_param( 'start_lng' );
        $end_lat = $request->get_param( 'end_lat' );
        $end_lng = $request->get_param( 'end_lng' );

        foreach ( array( $start_lat, $start_lng, $end_lat, $end_lng ) as $value ) {
            if ( ! is_numeric( $value ) ) {
                return new WP_Error( 'panachaiko_route_coordinates', 'Μη έγκυρες συντεταγμένες.', array( 'status' => 400 ) );
            }
        }

        $start_lat = (float) $start_lat;
        $start_lng = (float) $start_lng;
        $end_lat = (float) $end_lat;
        $end_lng = (float) $end_lng;

        // Keep the public proxy focused on Greece and the local trail use case.
        if ( ! self::inside_greece( $start_lat, $start_lng ) || ! self::inside_greece( $end_lat, $end_lng ) ) {
            return new WP_Error( 'panachaiko_route_bounds', 'Η δρομολόγηση υποστηρίζεται μόνο για συντεταγμένες στην Ελλάδα.', array( 'status' => 400 ) );
        }

        $body = array(
            'locations' => array(
                array( 'lat' => $start_lat, 'lon' => $start_lng, 'type' => 'break' ),
                array( 'lat' => $end_lat, 'lon' => $end_lng, 'type' => 'break' ),
            ),
            'costing' => 'pedestrian',
            'units' => 'kilometers',
            'directions_options' => array( 'units' => 'kilometers' ),
        );

        $response = wp_remote_post( self::VALHALLA_URL, array(
            'timeout' => 18,
            'redirection' => 2,
            'headers' => array(
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
                'X-Client-Id' => 'panachaikotrails.gr',
            ),
            'body' => wp_json_encode( $body ),
        ) );

        if ( is_wp_error( $response ) ) {
            return new WP_Error( 'panachaiko_route_upstream', 'Η υπηρεσία δρομολόγησης δεν απάντησε.', array( 'status' => 502 ) );
        }

        $status = (int) wp_remote_retrieve_response_code( $response );
        $decoded = json_decode( (string) wp_remote_retrieve_body( $response ), true );
        if ( $status < 200 || $status >= 300 || ! is_array( $decoded ) ) {
            return new WP_Error( 'panachaiko_route_failed', 'Δεν βρέθηκε πεζοπορική διαδρομή προς το επιλεγμένο μονοπάτι.', array( 'status' => 502 ) );
        }

        $trip = isset( $decoded['trip'] ) && is_array( $decoded['trip'] ) ? $decoded['trip'] : array();
        $legs = isset( $trip['legs'] ) && is_array( $trip['legs'] ) ? $trip['legs'] : array();
        $first_leg = isset( $legs[0] ) && is_array( $legs[0] ) ? $legs[0] : array();
        $summary = isset( $trip['summary'] ) && is_array( $trip['summary'] ) ? $trip['summary'] : array();
        $shape = isset( $first_leg['shape'] ) && is_string( $first_leg['shape'] ) ? $first_leg['shape'] : '';

        if ( '' === $shape ) {
            return new WP_Error( 'panachaiko_route_shape', 'Η υπηρεσία δρομολόγησης δεν επέστρεψε γεωμετρία.', array( 'status' => 502 ) );
        }

        return rest_ensure_response( array(
            'ok' => true,
            'provider' => 'valhalla-fossgis',
            'shape' => $shape,
            'shape_precision' => 6,
            'distance_km' => isset( $summary['length'] ) && is_numeric( $summary['length'] ) ? (float) $summary['length'] : null,
            'time_seconds' => isset( $summary['time'] ) && is_numeric( $summary['time'] ) ? (int) $summary['time'] : null,
        ) );
    }

    private static function inside_greece( float $lat, float $lng ): bool {
        return $lat >= 34.0 && $lat <= 42.5 && $lng >= 19.0 && $lng <= 30.5;
    }
}
