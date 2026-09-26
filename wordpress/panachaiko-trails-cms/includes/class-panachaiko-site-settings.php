<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

final class Panachaiko_Site_Settings {
    private const OPTION_UNDER_CONSTRUCTION = 'panachaiko_under_construction';
    private const OPTION_PUBLIC_TRAIL_SUBMISSIONS = 'panachaiko_public_trail_submissions';

    public static function init(): void {
        add_action( 'rest_api_init', array( __CLASS__, 'register_rest_routes' ) );
        add_action( 'admin_menu', array( __CLASS__, 'register_admin_page' ), 30 );
        add_action( 'admin_post_panachaiko_update_site_status', array( __CLASS__, 'handle_update' ) );
        add_action( 'admin_post_panachaiko_update_trail_submissions', array( __CLASS__, 'handle_trail_submissions_update' ) );
    }

    public static function is_under_construction(): bool {
        return '0' !== (string) get_option( self::OPTION_UNDER_CONSTRUCTION, '1' );
    }

    public static function public_trail_submissions_enabled(): bool {
        return '1' === (string) get_option( self::OPTION_PUBLIC_TRAIL_SUBMISSIONS, '0' );
    }

    public static function register_admin_page(): void {
        $parent = isset( $GLOBALS['admin_page_hooks']['panachaiko-trails-home'] ) ? 'panachaiko-trails-home' : null;

        if ( $parent ) {
            add_submenu_page(
                $parent,
                'Κατάσταση Ιστοσελίδας',
                'Κατάσταση Site',
                'manage_options',
                'panachaiko-site-status',
                array( __CLASS__, 'render_admin_page' )
            );
            return;
        }

        add_menu_page(
            'Κατάσταση Ιστοσελίδας',
            'Κατάσταση Site',
            'manage_options',
            'panachaiko-site-status',
            array( __CLASS__, 'render_admin_page' ),
            'dashicons-admin-site-alt3',
            22
        );
    }

    public static function render_admin_page(): void {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'Δεν έχετε δικαίωμα πρόσβασης.', 'panachaiko-trails' ) );
        }

        $enabled = self::is_under_construction();
        $saved = isset( $_GET['site_status_updated'] ) && '1' === sanitize_key( wp_unslash( $_GET['site_status_updated'] ) );
        $submissions_enabled = self::public_trail_submissions_enabled();
        $submissions_saved = isset( $_GET['trail_submissions_updated'] ) && '1' === sanitize_key( wp_unslash( $_GET['trail_submissions_updated'] ) );
        ?>
        <div class="wrap">
          <h1>Κατάσταση Ιστοσελίδας</h1>
          <?php if ( $saved ) : ?>
            <div class="notice notice-success is-dismissible"><p>Η ρύθμιση αποθηκεύτηκε.</p></div>
          <?php endif; ?>

          <div style="max-width:760px;margin-top:20px;padding:24px;border:1px solid #dcdcde;border-radius:12px;background:#fff;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#646970;">PANACHAIKO TRAILS</p>
            <h2 style="display:flex;align-items:center;gap:10px;margin:0 0 10px;font-size:22px;">
              <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:<?php echo $enabled ? '#ff601f' : '#28a745'; ?>;"></span>
              <?php echo esc_html( $enabled ? 'Under Construction — ΕΝΕΡΓΟ' : 'Δημόσια λειτουργία — ΕΝΕΡΓΗ' ); ?>
            </h2>
            <p style="font-size:15px;line-height:1.6;color:#50575e;">
              <?php echo esc_html( $enabled
                ? 'Οι επισκέπτες βλέπουν τη σελίδα «Υπό κατασκευή». Η ιδιωτική προεπισκόπηση παραμένει διαθέσιμη.'
                : 'Η κεντρική εφαρμογή και ο χάρτης είναι δημόσια προσβάσιμα χωρίς κωδικό προεπισκόπησης.'
              ); ?>
            </p>

            <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="margin-top:18px;">
              <input type="hidden" name="action" value="panachaiko_update_site_status">
              <input type="hidden" name="under_construction" value="<?php echo $enabled ? '0' : '1'; ?>">
              <?php wp_nonce_field( 'panachaiko_update_site_status' ); ?>
              <button type="submit" class="button button-primary button-hero">
                <?php echo esc_html( $enabled ? 'Απενεργοποίηση Under Construction' : 'Ενεργοποίηση Under Construction' ); ?>
              </button>
            </form>
          </div>
          <div style="max-width:760px;margin-top:20px;padding:24px;border:1px solid #dcdcde;border-radius:12px;background:#fff;">
            <h2>Προσθήκη μονοπατιού από επισκέπτες</h2>
            <p><?php echo esc_html( $submissions_enabled
                ? 'Οι επισκέπτες βλέπουν το κουμπί στον χάρτη και μπορούν να εγγραφούν και να υποβάλουν διαδρομές για έλεγχο.'
                : 'Το κουμπί κρύβεται από τον χάρτη. Η δημόσια εγγραφή και οι υποβολές είναι προσωρινά κλειστές. Οι διαχειριστές συνεχίζουν να διαχειρίζονται διαδρομές από το CMS.'
            ); ?></p>
            <?php if ( $submissions_saved ) : ?><div class="notice notice-success inline"><p>Η ρύθμιση υποβολών αποθηκεύτηκε.</p></div><?php endif; ?>
            <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
              <input type="hidden" name="action" value="panachaiko_update_trail_submissions">
              <input type="hidden" name="public_trail_submissions" value="<?php echo $submissions_enabled ? '0' : '1'; ?>">
              <?php wp_nonce_field( 'panachaiko_update_trail_submissions' ); ?>
              <button type="submit" class="button button-primary">
                <?php echo esc_html( $submissions_enabled ? 'Απενεργοποίηση δημόσιων υποβολών' : 'Ενεργοποίηση δημόσιων υποβολών' ); ?>
              </button>
            </form>
          </div>
        </div>
        <?php
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
            'public_trail_submissions' => self::public_trail_submissions_enabled(),
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
                'page' => 'panachaiko-site-status',
                'site_status_updated' => '1',
            ),
            admin_url( 'admin.php' )
        );
        wp_safe_redirect( $redirect );
        exit;
    }

    public static function handle_trail_submissions_update(): void {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'Δεν έχετε δικαίωμα να αλλάξετε αυτή τη ρύθμιση.', 'panachaiko-trails' ), '', array( 'response' => 403 ) );
        }

        check_admin_referer( 'panachaiko_update_trail_submissions' );
        $enabled = isset( $_POST['public_trail_submissions'] ) && '1' === sanitize_key( wp_unslash( $_POST['public_trail_submissions'] ) );
        update_option( self::OPTION_PUBLIC_TRAIL_SUBMISSIONS, $enabled ? '1' : '0', false );

        wp_safe_redirect( add_query_arg( array(
            'page' => 'panachaiko-site-status',
            'trail_submissions_updated' => '1',
        ), admin_url( 'admin.php' ) ) );
        exit;
    }
}
