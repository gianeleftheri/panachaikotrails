<?php
/**
 * Plugin Name: Panachaiko Trails CMS
 * Description: Headless WordPress data layer and REST API for Panachaiko Trails.
 * Version: 0.4.0
 * Author: Panachaiko Trails
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * Text Domain: panachaiko-trails
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'PANACHAIKO_TRAILS_VERSION', '0.4.0' );
define( 'PANACHAIKO_TRAILS_FILE', __FILE__ );
define( 'PANACHAIKO_TRAILS_DIR', plugin_dir_path( __FILE__ ) );

require_once PANACHAIKO_TRAILS_DIR . 'includes/class-panachaiko-post-types.php';
require_once PANACHAIKO_TRAILS_DIR . 'includes/class-panachaiko-meta.php';
require_once PANACHAIKO_TRAILS_DIR . 'includes/class-panachaiko-rest.php';
require_once PANACHAIKO_TRAILS_DIR . 'includes/class-panachaiko-migrations.php';
require_once PANACHAIKO_TRAILS_DIR . 'includes/class-panachaiko-routing.php';
require_once PANACHAIKO_TRAILS_DIR . 'includes/class-panachaiko-importer.php';

function panachaiko_trails_boot(): void {
    Panachaiko_Trails_Post_Types::init();
    Panachaiko_Trails_Meta::init();
    Panachaiko_Trails_REST::init();
    Panachaiko_Trails_Routing::init();
    Panachaiko_Trails_Migrations::init();
    Panachaiko_Trails_Importer::init();
}
add_action( 'plugins_loaded', 'panachaiko_trails_boot' );

function panachaiko_trails_activate(): void {
    Panachaiko_Trails_Post_Types::register();
    flush_rewrite_rules();
}
register_activation_hook( __FILE__, 'panachaiko_trails_activate' );

function panachaiko_trails_deactivate(): void {
    flush_rewrite_rules();
}
register_deactivation_hook( __FILE__, 'panachaiko_trails_deactivate' );
