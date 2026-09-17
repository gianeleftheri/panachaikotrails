<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

final class Panachaiko_Trails_Post_Types {
    public static function init(): void {
        add_action( 'init', array( __CLASS__, 'register' ) );
    }

    public static function register(): void {
        register_post_type(
            'trail',
            array(
                'labels' => array(
                    'name'          => 'Διαδρομές',
                    'singular_name' => 'Διαδρομή',
                    'add_new_item'  => 'Προσθήκη διαδρομής',
                    'edit_item'     => 'Επεξεργασία διαδρομής',
                ),
                'public'              => false,
                'show_ui'             => true,
                'show_in_rest'        => true,
                'menu_icon'           => 'dashicons-location-alt',
                'supports'            => array( 'title', 'editor', 'thumbnail', 'revisions' ),
                'has_archive'         => false,
                'rewrite'             => false,
                'exclude_from_search' => true,
            )
        );

        register_post_type(
            'trail_poi',
            array(
                'labels' => array(
                    'name'          => 'Σημεία διαδρομών',
                    'singular_name' => 'Σημείο διαδρομής',
                    'add_new_item'  => 'Προσθήκη σημείου',
                    'edit_item'     => 'Επεξεργασία σημείου',
                ),
                'public'              => false,
                'show_ui'             => true,
                'show_in_rest'        => true,
                'menu_icon'           => 'dashicons-location',
                'supports'            => array( 'title', 'editor', 'thumbnail', 'author', 'revisions' ),
                'has_archive'         => false,
                'rewrite'             => false,
                'exclude_from_search' => true,
            )
        );
    }
}
