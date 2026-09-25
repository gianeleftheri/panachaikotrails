<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

final class Panachaiko_Site_Settings {
    private const OPTION_UNDER_CONSTRUCTION = 'panachaiko_under_construction';

    public static function init(): void {
        add_action( 'rest_api_init', array( __CLASS__, 'register_rest_routes' ) );
        add_action( 'admin_menu', array( __CLASS__, 'register_admin_page' ), 30 );
        add_action( 'admin_post_panachaiko_update_site_status', array( __CLASS__, 'handle_update' ) );
    }

    public static function is_under_construction(): bool {
        return '0' !== (string) get_option( self::OPTION_UNDER_CONSTRUCTION, '1' );
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
}
