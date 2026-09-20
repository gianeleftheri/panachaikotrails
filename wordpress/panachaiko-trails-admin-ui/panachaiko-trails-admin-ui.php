<?php
/**
 * Plugin Name: Panachaiko Trails — Admin UI
 * Description: Responsive branded WordPress dashboard and CMS landing; leaves the core and data plugin intact.
 * Version: 0.3.0
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * Text Domain: panachaiko-trails-admin-ui
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class Panachaiko_Trails_Admin_UI {
    private const VERSION = '0.3.0';
    private const PAGE = 'panachaiko-trails-home';

    public static function init(): void {
        add_action( 'admin_menu', array( __CLASS__, 'register_menu' ) );
        add_action( 'admin_enqueue_scripts', array( __CLASS__, 'admin_assets' ) );
        add_action( 'login_enqueue_scripts', array( __CLASS__, 'login_assets' ) );
        add_action( 'admin_post_nopriv_pt_register_account', array( __CLASS__, 'register_account' ) );
        add_action( 'admin_post_nopriv_pt_verify_email', array( __CLASS__, 'verify_email' ) );
        add_action( 'admin_post_pt_verify_email', array( __CLASS__, 'verify_email' ) );
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
        wp_add_inline_style( 'panachaiko-admin-ui', '.pt-hero{background-image:url("' . esc_url( self::hero() ) . '")}' );
    }
    public static function login_assets(): void {
        wp_enqueue_style( 'panachaiko-admin-ui-login', self::url( 'admin.css' ), array(), self::VERSION );
    }

    private static function submission_url( array $args = array() ): string {
        return add_query_arg( array_merge( array( 'pt_action' => 'submit_trail' ), $args ), home_url( '/' ) );
    }

    private static function verification_hash( string $token ): string {
        return hash_hmac( 'sha256', $token, wp_salt( 'auth' ) );
    }

    private static function send_verification_email( WP_User $user ): bool {
        $token = wp_generate_password( 48, false, false );
        update_user_meta( $user->ID, 'pt_email_verification_hash', self::verification_hash( $token ) );
        update_user_meta( $user->ID, 'pt_email_verification_expires', time() + DAY_IN_SECONDS );
        $url = add_query_arg( array( 'action' => 'pt_verify_email', 'uid' => $user->ID, 'token' => $token ), admin_url( 'admin-post.php' ) );
        $subject = 'Επιβεβαίωση email — Panachaiko Trails';
        $message = "Γεια σας {$user->display_name},\n\nΕπιβεβαιώστε το email σας πατώντας τον παρακάτω σύνδεσμο:\n{$url}\n\nΟ σύνδεσμος ισχύει για 24 ώρες.";
        return (bool) wp_mail( $user->user_email, $subject, $message );
    }

    public static function register_account(): void {
        if ( is_user_logged_in() ) { wp_safe_redirect( self::submission_url( array( 'pt_status' => 'signed_in' ) ) ); exit; }
        if ( 'POST' !== strtoupper( (string) ( $_SERVER['REQUEST_METHOD'] ?? '' ) ) ) { wp_die( 'Μη επιτρεπτό αίτημα.', '', array( 'response' => 405 ) ); }
        check_admin_referer( 'pt_register_account' );
        if ( ! empty( $_POST['pt_company'] ) ) { wp_safe_redirect( self::submission_url( array( 'pt_status' => 'invalid' ) ) ); exit; }

        $remote = sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ?? 'unknown' ) );
        $rate_key = 'pt_reg_' . md5( $remote );
        if ( get_transient( $rate_key ) ) { wp_safe_redirect( self::submission_url( array( 'pt_status' => 'rate_limited' ) ) ); exit; }
        set_transient( $rate_key, 1, MINUTE_IN_SECONDS );

        $name = sanitize_text_field( wp_unslash( $_POST['pt_name'] ?? '' ) );
        $email = sanitize_email( wp_unslash( $_POST['pt_email'] ?? '' ) );
        $phone = preg_replace( '/[^0-9+]/', '', sanitize_text_field( wp_unslash( $_POST['pt_phone'] ?? '' ) ) );
        $password = (string) wp_unslash( $_POST['pt_password'] ?? '' );
        $confirm = (string) wp_unslash( $_POST['pt_password_confirm'] ?? '' );
        $consent = isset( $_POST['pt_terms'] );

        if ( mb_strlen( $name ) < 3 || ! is_email( $email ) || strlen( $phone ) < 10 || strlen( $password ) < 10 || $password !== $confirm || ! $consent ) {
            wp_safe_redirect( self::submission_url( array( 'pt_status' => 'invalid' ) ) ); exit;
        }
        if ( email_exists( $email ) ) { wp_safe_redirect( self::submission_url( array( 'pt_status' => 'email_exists' ) ) ); exit; }

        $base = sanitize_user( strstr( $email, '@', true ), true );
        if ( '' === $base ) { $base = 'hiker'; }
        $username = $base;
        $suffix = 1;
        while ( username_exists( $username ) ) { $username = $base . $suffix; ++$suffix; }

        $user_id = wp_insert_user( array(
            'user_login' => $username,
            'user_pass' => $password,
            'user_email' => $email,
            'display_name' => $name,
            'role' => 'subscriber',
        ) );
        if ( is_wp_error( $user_id ) ) { wp_safe_redirect( self::submission_url( array( 'pt_status' => 'failed' ) ) ); exit; }

        update_user_meta( $user_id, 'pt_phone', substr( (string) $phone, 0, 20 ) );
        update_user_meta( $user_id, 'pt_location_consent', '1' );
        update_user_meta( $user_id, 'pt_email_verified', '0' );
        $sent = self::send_verification_email( get_user_by( 'id', $user_id ) );
        wp_safe_redirect( self::submission_url( array( 'pt_status' => $sent ? 'check_email' : 'mail_failed' ) ) );
        exit;
    }

    public static function verify_email(): void {
        $user_id = absint( $_GET['uid'] ?? 0 );
        $token = sanitize_text_field( wp_unslash( $_GET['token'] ?? '' ) );
        $user = get_user_by( 'id', $user_id );
        $stored = (string) get_user_meta( $user_id, 'pt_email_verification_hash', true );
        $expires = (int) get_user_meta( $user_id, 'pt_email_verification_expires', true );
        if ( ! $user || '' === $token || '' === $stored || $expires < time() || ! hash_equals( $stored, self::verification_hash( $token ) ) ) {
            wp_safe_redirect( self::submission_url( array( 'pt_status' => 'verification_invalid' ) ) ); exit;
        }
        update_user_meta( $user_id, 'pt_email_verified', '1' );
        update_user_meta( $user_id, 'pt_email_verified_at', current_time( 'mysql', true ) );
        delete_user_meta( $user_id, 'pt_email_verification_hash' );
        delete_user_meta( $user_id, 'pt_email_verification_expires' );
        wp_safe_redirect( self::submission_url( array( 'pt_status' => 'verified' ) ) );
        exit;
    }

    private static function render_submission_portal(): void {
        $status = sanitize_key( wp_unslash( $_GET['pt_status'] ?? '' ) );
        $messages = array(
            'check_email' => array( 'ok', 'Ο λογαριασμός δημιουργήθηκε. Ελέγξτε το email σας για επιβεβαίωση.' ),
            'verified' => array( 'ok', 'Το email επιβεβαιώθηκε. Μπορείτε τώρα να συνδεθείτε.' ),
            'signed_in' => array( 'ok', 'Είστε ήδη συνδεδεμένος.' ),
            'email_exists' => array( 'warn', 'Υπάρχει ήδη λογαριασμός με αυτό το email. Επιλέξτε Σύνδεση.' ),
            'invalid' => array( 'warn', 'Ελέγξτε ότι όλα τα πεδία είναι σωστά και ο κωδικός έχει τουλάχιστον 10 χαρακτήρες.' ),
            'rate_limited' => array( 'warn', 'Περιμένετε ένα λεπτό πριν δοκιμάσετε ξανά.' ),
            'mail_failed' => array( 'warn', 'Ο λογαριασμός δημιουργήθηκε, αλλά δεν στάλθηκε email. Επικοινωνήστε με τον διαχειριστή.' ),
            'verification_invalid' => array( 'warn', 'Ο σύνδεσμος επιβεβαίωσης δεν είναι έγκυρος ή έχει λήξει.' ),
            'failed' => array( 'warn', 'Η εγγραφή δεν ολοκληρώθηκε. Δοκιμάστε ξανά.' ),
        );
        $login = wp_login_url( self::submission_url( array( 'pt_status' => 'signed_in' ) ) );
        $hero = self::hero();
        status_header( 200 ); nocache_headers();
        ?>
        <!doctype html><html <?php language_attributes(); ?>><head>
          <meta charset="<?php bloginfo( 'charset' ); ?>"><meta name="viewport" content="width=device-width,initial-scale=1">
          <meta name="robots" content="noindex,nofollow"><title>Πρόσθεσε μονοπάτι — Panachaiko Trails</title>
          <?php wp_head(); ?><link rel="stylesheet" href="<?php echo esc_url( self::url( 'admin.css' ) ); ?>">
        </head><body class="pt-private pt-account">
          <main class="pt-account-shell">
            <div class="pt-account-visual" style="background-image:url('<?php echo esc_url( $hero ); ?>')" aria-hidden="true"></div>
            <section class="pt-account-card">
              <a class="pt-account-back" href="https://panachaikotrails.gr/">← Επιστροφή στον χάρτη</a>
              <span class="pt-eyebrow">PANACHAIKO TRAILS</span><h1>Πρόσθεσε μονοπάτι</h1><p>Μοιράσου τη διαδρομή σου.</p>
              <?php if ( isset( $messages[ $status ] ) ) : ?><div class="pt-account-message pt-account-<?php echo esc_attr( $messages[ $status ][0] ); ?>"><?php echo esc_html( $messages[ $status ][1] ); ?></div><?php endif; ?>
              <?php if ( is_user_logged_in() ) : ?>
                <div class="pt-signed-in"><strong>Ο λογαριασμός σας είναι συνδεδεμένος.</strong><p>Στο επόμενο βήμα θα προστεθεί η φόρμα καταχώρισης της διαδρομής.</p></div>
              <?php else : ?>
                <div class="pt-auth-choice"><a class="pt-button" href="<?php echo esc_url( $login ); ?>">Σύνδεση</a><span>ή δημιουργήστε λογαριασμό</span></div>
                <form class="pt-register-form" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
                  <input type="hidden" name="action" value="pt_register_account"><?php wp_nonce_field( 'pt_register_account' ); ?>
                  <label>Ονοματεπώνυμο<input type="text" name="pt_name" minlength="3" autocomplete="name" required></label>
                  <label>Email<input type="email" name="pt_email" autocomplete="email" required></label>
                  <label>Κινητό<input type="tel" name="pt_phone" inputmode="tel" autocomplete="tel" placeholder="+3069XXXXXXXX" required></label>
                  <div class="pt-register-row"><label>Κωδικός<input type="password" name="pt_password" minlength="10" autocomplete="new-password" required></label><label>Επανάληψη κωδικού<input type="password" name="pt_password_confirm" minlength="10" autocomplete="new-password" required></label></div>
                  <label class="pt-honeypot" aria-hidden="true">Εταιρεία<input type="text" name="pt_company" tabindex="-1" autocomplete="off"></label>
                  <label class="pt-register-consent"><input type="checkbox" name="pt_terms" value="1" required><span>Συμφωνώ με τη δημιουργία λογαριασμού και τη χρήση της τοποθεσίας μόνο όταν ξεκινώ καταγραφή ή ενεργοποιώ SOS.</span></label>
                  <button class="pt-button" type="submit">Δημιουργία λογαριασμού</button>
                </form>
              <?php endif; ?>
            </section>
          </main><?php wp_footer(); ?>
        </body></html>
        <?php
        exit;
    }

    /** Only published trail metadata. Never insert made-up elevation or demo statistics. */
    private static function trail_metrics(): array {
        $ids = post_type_exists( 'trail' ) ? get_posts( array(
            'post_type' => 'trail', 'post_status' => 'publish', 'posts_per_page' => -1,
            'fields' => 'ids', 'no_found_rows' => true,
        ) ) : array();
        $length = 0.0;
        $gain = 0.0;
        $highest = null;
        $has_length = false;
        $has_gain = false;
        foreach ( $ids as $id ) {
            $km = get_post_meta( $id, 'length_km', true );
            $elevation = get_post_meta( $id, 'elev_max', true );
            $climb = get_post_meta( $id, 'gain_m', true );
            if ( is_numeric( $km ) && (float) $km >= 0 ) { $length += (float) $km; $has_length = true; }
            if ( is_numeric( $elevation ) && (float) $elevation >= 0 ) {
                $highest = null === $highest ? (float) $elevation : max( $highest, (float) $elevation );
            }
            if ( is_numeric( $climb ) && (float) $climb >= 0 ) { $gain += (float) $climb; $has_gain = true; }
        }
        return array( 'routes' => count( $ids ), 'length' => $has_length ? $length : null,
            'highest' => $highest, 'gain' => $has_gain ? $gain : null );
    }
    private static function render_trail_metrics( array $data ): void {
        $items = array(
            array( 'ΔΗΜΟΣΙΕΥΜΕΝΕΣ ΔΙΑΔΡΟΜΕΣ', number_format_i18n( $data['routes'] ), 'μονοπάτια' ),
            array( 'ΣΥΝΟΛΙΚΗ ΑΠΟΣΤΑΣΗ', null === $data['length'] ? '—' : number_format_i18n( $data['length'], 1 ), 'χλμ.' ),
            array( 'ΜΕΓΙΣΤΟ ΥΨΟΜΕΤΡΟ ΔΙΑΔΡΟΜΩΝ', null === $data['highest'] ? '—' : number_format_i18n( $data['highest'] ), 'μ.' ),
            array( 'ΣΥΝΟΛΙΚΗ ΑΝΑΒΑΣΗ', null === $data['gain'] ? '—' : number_format_i18n( $data['gain'] ), 'μ.' ),
        );
        ?>
        <section class="pt-hero-metrics" aria-label="Στοιχεία δημοσιευμένων διαδρομών">
          <?php foreach ( $items as $item ) : ?>
            <div class="pt-hero-metric">
              <span class="pt-hero-metric-label"><?php echo esc_html( $item[0] ); ?></span>
              <div class="pt-hero-metric-line"><strong><?php echo esc_html( $item[1] ); ?></strong><span><?php echo esc_html( $item[2] ); ?></span></div>
            </div>
          <?php endforeach; ?>
        </section>
        <?php
    }

    public static function cms_home(): void {
        // Restricted to the CMS host; the public Astro website and WP REST routes are untouched.
        if ( 'cms.panachaikotrails.gr' !== strtolower( (string) wp_parse_url( home_url(), PHP_URL_HOST ) ) || ! is_front_page() || is_admin() ) { return; }
        if ( 'submit_trail' === sanitize_key( wp_unslash( $_GET['pt_action'] ?? '' ) ) ) { self::render_submission_portal(); }
        if ( is_user_logged_in() && current_user_can( 'edit_posts' ) ) {
            wp_safe_redirect( admin_url( 'admin.php?page=' . self::PAGE ) ); exit;
        }
        if ( is_user_logged_in() ) { return; }
        status_header( 200 ); nocache_headers();
        $login = wp_login_url( admin_url( 'admin.php?page=' . self::PAGE ) );
        $public = 'https://panachaikotrails.gr/';
        $hero = self::hero();
        $metrics = self::trail_metrics();
        ?>
        <!doctype html><html <?php language_attributes(); ?>><head>
          <meta charset="<?php bloginfo( 'charset' ); ?>"><meta name="viewport" content="width=device-width, initial-scale=1">
          <meta name="robots" content="noindex,nofollow"><title>Panachaiko Trails — Ιδιωτικό CMS</title>
          <?php wp_head(); ?><link rel="stylesheet" href="<?php echo esc_url( self::url( 'admin.css' ) ); ?>">
        </head><body class="pt-private">
          <main class="pt-private-card">
            <div class="pt-private-visual" style="background-image:url('<?php echo esc_url( $hero ); ?>')" aria-hidden="true"></div>
            <div class="pt-private-body">
              <span class="pt-eyebrow">PANACHAIKO TRAILS / CONTENT MANAGEMENT</span>
              <h1><span>ΠΑΝΑΧΑΪΚΟ</span><em>TRAILS</em></h1>
              <p>Το βουνό, οι διαδρομές και οι ιστορίες του. Ιδιωτικό περιβάλλον διαχείρισης.</p>
              <div class="pt-private-actions">
                <a class="pt-button" href="<?php echo esc_url( $login ); ?>">Είσοδος στη διαχείριση →</a>
                <a class="pt-link" href="<?php echo esc_url( $public ); ?>">Κύρια ιστοσελίδα ↗</a>
              </div>
            </div>
            <?php self::render_trail_metrics( $metrics ); ?>
          </main><?php wp_footer(); ?>
        </body></html>
        <?php
        exit;
    }
    private static function count( string $type, string $status ): int {
        $counts = wp_count_posts( $type );
        return isset( $counts->$status ) ? (int) $counts->$status : 0;
    }
    public static function render_dashboard(): void {
        if ( ! current_user_can( 'edit_posts' ) ) { wp_die( esc_html__( 'Δεν έχετε δικαίωμα πρόσβασης.' ) ); }
        $recent = get_posts( array( 'post_type' => 'post', 'post_status' => array( 'publish', 'draft' ), 'numberposts' => 4, 'orderby' => 'modified', 'order' => 'DESC' ) );
        $routes = get_posts( array( 'post_type' => 'trail', 'post_status' => array( 'publish', 'draft' ), 'numberposts' => 3, 'orderby' => 'modified', 'order' => 'DESC' ) );
        $metrics = self::trail_metrics();
        $cards = array(
            array( 'Δημοσιευμένα άρθρα', self::count( 'post', 'publish' ), 'dashicons-media-document' ),
            array( 'Διαδρομές', self::count( 'trail', 'publish' ) + self::count( 'trail', 'draft' ), 'dashicons-location-alt' ),
            array( 'Σημεία ενδιαφέροντος', self::count( 'trail_poi', 'publish' ) + self::count( 'trail_poi', 'draft' ), 'dashicons-location' ),
            array( 'Αρχεία πολυμέσων', self::count( 'attachment', 'inherit' ), 'dashicons-format-image' ),
        );
        ?>
        <div class="wrap pt-dashboard">
          <header class="pt-hero" role="banner">
            <div class="pt-hero-copy">
              <span class="pt-eyebrow">PANACHAIKO TRAILS / CONTENT MANAGEMENT</span>
              <h1><span>ΠΑΝΑΧΑΪΚΟ</span><em>TRAILS</em></h1>
              <p>Βουνό. Διαδρομές. Άνθρωποι. Ιστορίες.</p>
              <a class="pt-button" href="<?php echo esc_url( admin_url( 'post-new.php?post_type=trail' ) ); ?>">+ Νέα διαδρομή</a>
            </div>
            <?php self::render_trail_metrics( $metrics ); ?>
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
              <?php if ( $routes ) : ?><div class="pt-route-list"><?php foreach ( $routes as $route ) : ?><a href="<?php echo esc_url( get_edit_post_link( $route->ID ) ); ?>"><span class="dashicons dashicons-location-alt"></span><span><?php echo esc_html( get_the_title( $route ) ?: '(Χωρίς τίτλο)' ); ?></span><small><?php echo esc_html( 'publish' === $route->post_status ? 'Δημοσιευμένη' : 'Προσχέδιο' ); ?><?php $km = get_post_meta( $route->ID, 'length_km', true ); $elevation = get_post_meta( $route->ID, 'elev_max', true ); if ( is_numeric( $km ) ) : ?> · <?php echo esc_html( number_format_i18n( (float) $km, 1 ) ); ?> χλμ.<?php endif; ?><?php if ( is_numeric( $elevation ) ) : ?> · υψ. <?php echo esc_html( number_format_i18n( (float) $elevation ) ); ?> μ.<?php endif; ?></small></a><?php endforeach; ?></div>
              <?php else : ?><p class="pt-empty">Δεν έχουν προστεθεί ακόμη διαδρομές. <a href="<?php echo esc_url( admin_url( 'post-new.php?post_type=trail' ) ); ?>">Προσθήκη διαδρομής</a></p><?php endif; ?>
            </section>
          </div>
          <p class="pt-note">Μήκος, υψόμετρο και ανάβαση προέρχονται από δημοσιευμένες διαδρομές WordPress. Το μέγιστο υψόμετρο διαδρομών δεν είναι κατ’ ανάγκην το υψόμετρο της κορυφής του βουνού.</p>
        </div>
        <?php
    }
}
Panachaiko_Trails_Admin_UI::init();
