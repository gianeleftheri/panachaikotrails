<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

final class Panachaiko_Trails_Migrations {
    private const SCHEMA_VERSION = '0.4.0';

    private const NAVIGATION = array(
        'Π-1' => array( 'start_lat'=>38.21010, 'start_lng'=>21.81254, 'start_label'=>'ΠΟΥΡΝΑΡΟΚΑΣΤΡΟ', 'end_lat'=>38.21293, 'end_lng'=>21.84344, 'end_label'=>'ΚΑΤΑΦΥΓΙΟ', 'verified'=>true ),
        'Π-12' => array( 'start_lat'=>38.15207, 'start_lng'=>21.85482, 'start_label'=>'ΜΟΙΡΑ', 'end_lat'=>38.19612, 'end_lng'=>21.87071, 'end_label'=>'ΚΟΡΥΦΗ', 'verified'=>true ),
        'Π-12Α' => array( 'start_lat'=>38.15168, 'start_lng'=>21.87742, 'start_label'=>'Π-12Α · Αφετηρία', 'end_lat'=>38.15819, 'end_lng'=>21.88413, 'end_label'=>'Π-12Α · Τέλος', 'verified'=>false ),
        'Π-14' => array( 'start_lat'=>38.15207, 'start_lng'=>21.85482, 'start_label'=>'ΜΟΙΡΑ', 'end_lat'=>38.13935, 'end_lng'=>21.90186, 'end_label'=>'ΒΕΤΑΙΪΚΑ', 'verified'=>true ),
        'Π-3' => array( 'start_lat'=>38.22888, 'start_lng'=>21.79129, 'start_label'=>'ΡΩΜΑΝΟΣ', 'end_lat'=>38.23064, 'end_lng'=>21.83127, 'end_label'=>'ΚΟΚΚΙΝΟΒΡΥΣΗ', 'verified'=>true ),
        'Π-4' => array( 'start_lat'=>38.25456, 'start_lng'=>21.79886, 'start_label'=>'ΜΠΑΛΑ', 'end_lat'=>38.23114, 'end_lng'=>21.83039, 'end_label'=>'ΚΟΚΚΙΝΟΒΡΥΣΗ', 'verified'=>true ),
        'Π-5' => array( 'start_lat'=>38.23064, 'start_lng'=>21.83127, 'start_label'=>'ΚΟΚΚΙΝΟΒΡΥΣΗ', 'end_lat'=>38.21411, 'end_lng'=>21.84418, 'end_label'=>'ΚΑΤΑΦΥΓΙΟ ΨΑΡΘΙ', 'verified'=>true ),
        'Π-6' => array( 'start_lat'=>38.21293, 'start_lng'=>21.84344, 'start_label'=>'ΚΑΤΑΦΥΓΙΟ', 'end_lat'=>38.20300, 'end_lng'=>21.86443, 'end_label'=>'ΠΡΑΣΟΥΔΙ', 'verified'=>true ),
        'Π-8' => array( 'start_lat'=>38.27153, 'start_lng'=>21.83519, 'start_label'=>'ΑΝΩ ΚΑΣΤΡΙΤΣΙ', 'end_lat'=>38.20300, 'end_lng'=>21.86443, 'end_label'=>'ΠΡΑΣΟΥΔΙ', 'verified'=>true ),
        'Π-9' => array( 'start_lat'=>38.20300, 'start_lng'=>21.86443, 'start_label'=>'ΠΡΑΣΟΥΔΙ', 'end_lat'=>38.19612, 'end_lng'=>21.87071, 'end_label'=>'ΚΟΡΥΦΗ', 'verified'=>true ),
        'Ε31' => array( 'start_lat'=>38.19391, 'start_lng'=>21.77157, 'start_label'=>'ACHAIA CLAUS', 'end_lat'=>38.15943, 'end_lng'=>21.81247, 'end_label'=>'ΠΕΤΡΩΤΟ', 'verified'=>true ),
        'Π-13' => array( 'start_lat'=>38.15943, 'start_lng'=>21.81247, 'start_label'=>'ΠΕΤΡΩΤΟ (διασταύρωση)', 'end_lat'=>38.15207, 'end_lng'=>21.85482, 'end_label'=>'ΜΟΙΡΑ', 'verified'=>true ),
        'Π-1Α' => array( 'start_lat'=>38.21634, 'start_lng'=>21.81876, 'start_label'=>'ΣΥΝΔΕΣΗ ΑΠΟ Π-1', 'end_lat'=>38.22227, 'end_lng'=>21.81982, 'end_label'=>'ΣΥΝΔΕΣΗ ΠΡΟΣ Π-3', 'verified'=>false ),
    );

    public static function init(): void {
        add_action( 'init', array( __CLASS__, 'maybe_migrate' ), 30 );
    }

    public static function maybe_migrate(): void {
        if ( version_compare( (string) get_option( 'panachaiko_trails_schema_version', '0.0.0' ), self::SCHEMA_VERSION, '>=' ) ) return;
        $trails = get_posts( array( 'post_type'=>'trail', 'post_status'=>'any', 'posts_per_page'=>-1, 'fields'=>'ids' ) );
        foreach ( $trails as $trail_id ) {
            $code = (string) get_post_meta( (int) $trail_id, 'trail_code', true );
            self::seed_navigation_for_trail( (int) $trail_id, $code );
        }
        update_option( 'panachaiko_trails_schema_version', self::SCHEMA_VERSION, false );
    }

    public static function seed_navigation_for_trail( int $trail_id, string $code ): void {
        if ( ! isset( self::NAVIGATION[ $code ] ) ) return;
        $config = self::NAVIGATION[ $code ];
        $fields = array(
            'start_lat'=>$config['start_lat'], 'start_lng'=>$config['start_lng'], 'start_label'=>$config['start_label'],
            'end_lat'=>$config['end_lat'], 'end_lng'=>$config['end_lng'], 'end_label'=>$config['end_label'],
            'direction_verified'=>$config['verified'] ? 1 : 0,
        );
        foreach ( $fields as $key=>$value ) {
            if ( '' === (string) get_post_meta( $trail_id, $key, true ) ) update_post_meta( $trail_id, $key, $value );
        }
    }
}
