<?php
/**
 * Plugin Name: Panachaiko Trails — Admin UI
 * Description: Branded CMS landing and WordPress dashboard without modifying WordPress core or the Panachaiko data plugin.
 * Version: 0.1.0
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * Text Domain: panachaiko-trails-admin-ui
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

final class Panachaiko_Trails_Admin_UI {
    private const VERSION = '0.1.0';
    private const PAGE = 'panachaiko-trails-home';

    public static function init(): void {
        add_action( 'admin_menu', array( __CLASS__, 'register_menu' ) );
        add_action( 'admin_enqueue_scripts', array( __CLASS__, 'admin_assets' ) );
        add_action( 'login_enqueue_scripts', array( __CLASS__, 'login_assets' ) );
        add_action( 'template_redirect', array( __CLASS__, 'cms_home' ) );
    }

    private static function url( string $file ): string {
        return plugin_dir_url( __FILE__ ) . 'assets/' . $file;
    }

    private static function hero(): string {
        return self::url( file_exists( plugin_dir_path( __FILE__ ) . 'assets/hero-panachaiko.webp' ) ? 'hero-panachaiko.webp' : 'hero-panachaiko.svg' );
    }

    public static function register_menu(): void {
        add_menu_page( 'Panachaiko Trails', 'Panachaiko Trails', 'edit_posts', self::PAGE, array( __CLASS__, 'render_dashboard' ), 'dashicons-location-alt', 2 );
    }

    public static function admin_assets(): void {
        wp_enqueue_style( 'panachaiko-admin-ui', self::url( 'admin.css' ), array(), self::VERSION );
        // Pass the hero URL through WordPress escaping, never through unsanitized input.
        wp_add_inline_style( 'panachaiko-admin-ui', '.pt-hero,.pt-private-visual{background-image:url("' . esc_url( self::hero() ) . '")}' );
    }

    public static function login_assets(): void {
        wp_enqueue_style( 'panachaiko-admin-ui-login', self::url( 'admin.css' ), array(), self::VERSION );
    }

    public static function cms_home(): void {
        // Only the CMS subdomain is affected; the public Astro website remains untouched.
        if ( 'cms.panachaikotrails.gr' !== strtolower( (string) wp_parse_url( home_url(), PHP_URL_HOST ) ) || ! is_front_page() || is_admin() ) {
            return;
        }
        if ( is_user_logged_in() && current_user_can( 'edit_posts' ) ) {
            wp_safe_redirect( admin_url( 'admin.php?page=' . self::PAGE ) );
            exit;
        }
        if ( is_user_logged_in() ) {
            return;
        }
        status_header( 200 );
        nocache_headers();
        $login = wp_login_url( admin_url( 'admin.php?page=' . self::PAGE ) );
        $public = 'https://panachaikotrails.gr/';
        $hero = self::hero();
        ?>
        <!doctype html>
        <html <?php language_attributes(); ?>>
        <head>
            <meta charset="<?php bloginfo( 'charset' ); ?>">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta name="robots" content="noindex,nofollow">
            <title><?php echo esc_html( 'Panachaiko Trails — Ιδιωτικό CMS' ); ?></title>
            <?php wp_head(); ?>
            <link rel="stylesheet" href="<?php echo esc_url( self::url( 'admin.css' ) ); ?>">
        </head>
        <body class="pt-private">
          <main class="pt-private-card">
            <div class="pt-private-visual" style="background-image:url('<?php echo esc_url( $hero ); ?>')"></div>
            <div class="pt-private-body">
              <span class="pt-eyebrow">PANACHAIKO TRAILS · CONTENT MANAGEMENT</span>
              <h1>Μονοπάτια Παναχαϊκού</h1>
              <p>Ιδιωτικό περιβάλλον διαχείρισης διαδρομών, ιστοριών και υλικού.</p>
              <div class="pt-private-actions">
                <a class="pt-button" href="<?php echo esc_url( $login ); ?>">Είσοδος στη διαχείριση →</a>
                <a class="pt-link" href="<?php echo esc_url( $public ); ?>">Κύρια ιστοσελίδα ↗</a>
              </div>
            </div>
          </main>
          <?php wp_footer(); ?>
        </body>
        </html>
        <?php
        exit;
    }

    private static function count( string $type, string $status ): int {
        $counts = wp_count_posts( $type );
        return isset( $counts->$status ) ? (int) $counts->$status : 0;
    }

    public static function render_dashboard(): void {
        if ( ! current_user_can( 'edit_posts' ) ) {
            wp_die( esc_html__( 'Δεν έχετε δικαίωμα πρόσβασης.' ) );
        }
        $recent = get_posts( array( 'post_type' => 'post', 'post_status' => array( 'publish', 'draft' ), 'numberposts' => 4, 'orderby' => 'modified', 'order' => 'DESC' ) );
        $routes = get_posts( array( 'post_type' => 'trail', 'post_status' => array( 'publish', 'draft' ), 'numberposts' => 3, 'orderby' => 'modified', 'order' => 'DESC' ) );
        $cards = array(
            array( 'Δημοσιευμένα άρθρα', self::count( 'post', 'publish' ), 'dashicons-media-document' ),
            array( 'Διαδρομές', self::count( 'trail', 'publish' ) + self::count( 'trail', 'draft' ), 'dashicons-location-alt' ),
            array( 'Σημεία ενδιαφέροντος', self::count( 'trail_poi', 'publish' ) + self::count( 'trail_poi', 'draft' ), 'dashicons-location' ),
            array( 'Αρχεία πολυμέσων', self::count( 'attachment', 'inherit' ), 'dashicons-format-image' ),
        );
        ?>
        <div class="wrap pt-dashboard">
          <header class="pt-hero" role="banner">
            <div class="pt-hero-copy"><span class="pt-eyebrow">PANACHAIKO TRAILS · CMS</span><h1>Καλώς ήρθατε<br>στο Παναχαϊκό</h1><p>Βουνό. Διαδρομές. Άνθρωποι. Ιστορίες.</p><a class="pt-button" href="<?php echo esc_url( admin_url( 'post-new.php?post_type=trail' ) ); ?>">+ Νέα διαδρομή</a></div>
          </header>
          <section class="pt-stats" aria-label="Σύνοψη περιεχομένου">
          <?php foreach ( $cards as $card ) : ?>
            <div class="pt-stat"><span class="dashicons <?php echo esc_attr( $card[2] ); ?>" aria-hidden="true"></span><div><span class="pt-stat-title"><?php echo esc_html( $card[0] ); ?></span><strong><?php echo esc_html( number_format_i18n( $card[1] ) ); ?></strong></div></div>
          <?php endforeach; ?>
          </section>
          <div class="pt-grid">
            <section class="pt-panel"><div class="pt-panel-head"><h2>Πρόσφατα άρθρα</h2><a href="<?php echo esc_url( admin_url( 'edit.php' ) ); ?>">Όλα τα άρθρα →</a></div>
              <?php if ( $recent ) : ?><ul class="pt-records"><?php foreach ( $recent as $item ) : ?><li><a href="<?php echo esc_url( get_edit_post_link( $item->ID ) ); ?>"><?php echo esc_html( get_the_title( $item ) ?: '(Χωρίς τίτλο)' ); ?></a><small><?php echo esc_html( 'publish' === $item->post_status ? 'Δημοσιευμένο' : 'Προσχέδιο' ); ?> · <?php echo esc_html( get_the_modified_date( 'd/m/Y', $item ) ); ?></small></li><?php endforeach; ?></ul>
              <?php else : ?><p class="pt-empty">Δεν υπάρχουν ακόμη άρθρα.</p><?php endif; ?>
            </section>
            <section class="pt-panel"><div class="pt-panel-head"><h2>Γρήγορες ενέργειες</h2></div><nav class="pt-actions" aria-label="Γρήγορες ενέργειες">
              <a href="<?php echo esc_url( admin_url( 'post-new.php' ) ); ?>"><span class="dashicons dashicons-edit"></span> Νέο άρθρο <span>→</span></a>
              <a href="<?php echo esc_url( admin_url( 'post-new.php?post_type=trail' ) ); ?>"><span class="dashicons dashicons-location-alt"></span> Νέα διαδρομή <span>→</span></a>
              <a href="<?php echo esc_url( admin_url( 'upload.php' ) ); ?>"><span class="dashicons dashicons-format-image"></span> Βιβλιοθήκη πολυμέσων <span>→</span></a>
              <?php if ( current_user_can( 'manage_options' ) ) : ?><a href="<?php echo esc_url( admin_url( 'tools.php?page=panachaiko-trails-import' ) ); ?>"><span class="dashicons dashicons-upload"></span> Εισαγωγή διαδρομών <span>→</span></a><?php endif; ?>
            </nav></section>
            <section class="pt-panel pt-routes"><div class="pt-panel-head"><h2>Διαδρομές</h2><a href="<?php echo esc_url( admin_url( 'edit.php?post_type=trail' ) ); ?>">Όλες οι διαδρομές →</a></div>
              <?php if ( $routes ) : ?><div class="pt-route-list"><?php foreach ( $routes as $route ) : ?><a href="<?php echo esc_url( get_edit_post_link( $route->ID ) ); ?>"><span class="dashicons dashicons-location-alt"></span><span><?php echo esc_html( get_the_title( $route ) ?: '(Χωρίς τίτλο)' ); ?></span><small><?php echo esc_html( 'publish' === $route->post_status ? 'Δημοσιευμένη' : 'Προσχέδιο' ); ?></small></a><?php endforeach; ?></div>
              <?php else : ?><p class="pt-empty">Δεν έχουν προστεθεί ακόμη διαδρομές. <a href="<?php echo esc_url( admin_url( 'post-new.php?post_type=trail' ) ); ?>">Προσθήκη διαδρομής</a></p><?php endif; ?>
            </section>
          </div>
          <p class="pt-note">Τα στατιστικά προέρχονται από τις πραγματικές εγγραφές WordPress. Δεν εμφανίζονται πλασματικά δεδομένα επισκεψιμότητας.</p>
        </div>
        <?php
    }
}
Panachaiko_Trails_Admin_UI::init();
