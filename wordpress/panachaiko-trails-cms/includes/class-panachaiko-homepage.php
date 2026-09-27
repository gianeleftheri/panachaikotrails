<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

final class Panachaiko_Homepage_Settings {
    private const OPTION = 'panachaiko_homepage_settings';
    private const CAPABILITY = 'edit_others_posts';

    private const PANELS = array(
        'home'    => 'Αρχική / Blog',
        'trails'  => 'Μονοπάτια',
        'poi'     => 'Σημεία Ενδιαφέροντος',
        'shelter' => 'Καταφύγια',
        'photos'  => 'Φωτογραφίες',
        'video'   => 'Βίντεο',
    );

    private const FALLBACK_IMAGES = array(
        'home'    => 'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1800&q=90',
        'trails'  => 'https://images.unsplash.com/photo-1464278533981-50106e6176b1?auto=format&fit=crop&w=1800&q=90',
        'poi'     => 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1800&q=90',
        'shelter' => 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1800&q=90',
        'photos'  => 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1800&q=90',
        'video'   => 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=90',
    );

    public static function init(): void {
        add_action( 'admin_menu', array( __CLASS__, 'register_admin_page' ), 31 );
        add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_admin_assets' ) );
        add_action( 'admin_post_panachaiko_update_homepage', array( __CLASS__, 'handle_update' ) );
        add_action( 'rest_api_init', array( __CLASS__, 'register_rest_routes' ) );
    }

    private static function defaults(): array {
        $settings = array(
            'home_category' => 0,
        );
        foreach ( array_keys( self::PANELS ) as $panel ) {
            $settings[ $panel . '_count' ] = 4;
            $settings[ $panel . '_image_id' ] = 0;
        }
        return $settings;
    }

    public static function settings(): array {
        $saved = get_option( self::OPTION, array() );
        return wp_parse_args( is_array( $saved ) ? $saved : array(), self::defaults() );
    }

    public static function register_admin_page(): void {
        $parent = isset( $GLOBALS['admin_page_hooks']['panachaiko-trails-home'] ) ? 'panachaiko-trails-home' : null;

        if ( $parent ) {
            add_submenu_page(
                $parent,
                'Αρχική Σελίδα',
                'Αρχική Σελίδα',
                self::CAPABILITY,
                'panachaiko-homepage',
                array( __CLASS__, 'render_admin_page' )
            );
            return;
        }

        add_menu_page(
            'Αρχική Σελίδα',
            'Αρχική Σελίδα',
            self::CAPABILITY,
            'panachaiko-homepage',
            array( __CLASS__, 'render_admin_page' ),
            'dashicons-screenoptions',
            23
        );
    }

    public static function enqueue_admin_assets( string $hook ): void {
        if ( false === strpos( $hook, 'panachaiko-homepage' ) ) return;
        if ( ! current_user_can( self::CAPABILITY ) ) return;
        wp_enqueue_media();
    }

    public static function render_admin_page(): void {
        if ( ! current_user_can( self::CAPABILITY ) ) {
            wp_die( esc_html__( 'Δεν έχετε δικαίωμα πρόσβασης.', 'panachaiko-trails' ) );
        }

        $settings = self::settings();
        $saved = isset( $_GET['homepage_updated'] ) && '1' === sanitize_key( wp_unslash( $_GET['homepage_updated'] ) );
        $categories = get_categories( array( 'hide_empty' => false ) );
        ?>
        <div class="wrap">
          <h1>Αρχική Σελίδα</h1>
          <p>Ρυθμίσεις περιεχομένου για τα accordion panels της δημόσιας αρχικής σελίδας.</p>
          <?php if ( $saved ) : ?><div class="notice notice-success is-dismissible"><p>Οι ρυθμίσεις αποθηκεύτηκαν.</p></div><?php endif; ?>

          <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
            <input type="hidden" name="action" value="panachaiko_update_homepage">
            <?php wp_nonce_field( 'panachaiko_update_homepage' ); ?>

            <div style="max-width:1100px;display:grid;gap:18px;">
              <div style="padding:18px;border:1px solid #dcdcde;border-radius:12px;background:#fff;">
                <h2 style="margin-top:0;">Blog στην «Αρχική»</h2>
                <label for="panachaiko_home_category"><strong>Κατηγορία άρθρων</strong></label><br>
                <select id="panachaiko_home_category" name="home_category" style="min-width:300px;margin-top:6px;">
                  <option value="0">Όλες οι κατηγορίες</option>
                  <?php foreach ( $categories as $category ) : ?>
                    <option value="<?php echo esc_attr( $category->term_id ); ?>" <?php selected( (int) $settings['home_category'], (int) $category->term_id ); ?>>
                      <?php echo esc_html( $category->name ); ?>
                    </option>
                  <?php endforeach; ?>
                </select>
              </div>

              <?php foreach ( self::PANELS as $key => $label ) :
                $image_id = absint( $settings[ $key . '_image_id' ] );
                $image_url = $image_id ? wp_get_attachment_image_url( $image_id, 'large' ) : '';
              ?>
                <section style="padding:18px;border:1px solid #dcdcde;border-radius:12px;background:#fff;">
                  <h2 style="margin-top:0;"><?php echo esc_html( $label ); ?></h2>
                  <div style="display:grid;grid-template-columns:minmax(180px,260px) 1fr;gap:18px;align-items:start;">
                    <div>
                      <label for="panachaiko_<?php echo esc_attr( $key ); ?>_count"><strong>Πόσες τελευταίες εγγραφές</strong></label>
                      <input id="panachaiko_<?php echo esc_attr( $key ); ?>_count" name="<?php echo esc_attr( $key ); ?>_count" type="number" min="1" max="12" value="<?php echo esc_attr( $settings[ $key . '_count' ] ); ?>" style="display:block;width:100px;margin-top:6px;">
                    </div>
                    <div>
                      <strong>Background φωτογραφία</strong>
                      <input type="hidden" id="panachaiko_<?php echo esc_attr( $key ); ?>_image_id" name="<?php echo esc_attr( $key ); ?>_image_id" value="<?php echo esc_attr( $image_id ); ?>">
                      <div style="display:flex;align-items:center;gap:12px;margin-top:8px;flex-wrap:wrap;">
                        <img id="panachaiko_<?php echo esc_attr( $key ); ?>_preview" src="<?php echo esc_url( $image_url ?: self::FALLBACK_IMAGES[ $key ] ); ?>" alt="" style="width:180px;height:110px;object-fit:cover;border-radius:8px;border:1px solid #dcdcde;">
                        <button class="button panachaiko-media-select" type="button" data-panel="<?php echo esc_attr( $key ); ?>">Επιλογή από Βιβλιοθήκη</button>
                        <button class="button panachaiko-media-clear" type="button" data-panel="<?php echo esc_attr( $key ); ?>">Χρήση προεπιλογής</button>
                      </div>
                      <p class="description">Προτεινόμενο: 1800×1200 px ή μεγαλύτερη, WebP/JPEG, ιδανικά έως 1.5 MB.</p>
                    </div>
                  </div>
                </section>
              <?php endforeach; ?>

              <p><button class="button button-primary button-hero" type="submit">Αποθήκευση Αρχικής Σελίδας</button></p>
            </div>
          </form>
        </div>
        <script>
        (() => {
          document.querySelectorAll('.panachaiko-media-select').forEach(button => {
            button.addEventListener('click', () => {
              const panel = button.dataset.panel;
              const frame = wp.media({
                title: 'Επιλογή φωτογραφίας',
                button: { text: 'Χρήση φωτογραφίας' },
                library: { type: 'image' },
                multiple: false
              });
              frame.on('select', () => {
                const attachment = frame.state().get('selection').first().toJSON();
                document.getElementById('panachaiko_' + panel + '_image_id').value = attachment.id;
                const url = attachment.sizes && attachment.sizes.large ? attachment.sizes.large.url : attachment.url;
                document.getElementById('panachaiko_' + panel + '_preview').src = url;
              });
              frame.open();
            });
          });
          document.querySelectorAll('.panachaiko-media-clear').forEach(button => {
            button.addEventListener('click', () => {
              const panel = button.dataset.panel;
              document.getElementById('panachaiko_' + panel + '_image_id').value = '0';
              document.getElementById('panachaiko_' + panel + '_preview').src = <?php echo wp_json_encode( self::FALLBACK_IMAGES ); ?>[panel];
            });
          });
        })();
        </script>
        <?php
    }

    public static function handle_update(): void {
        if ( ! current_user_can( self::CAPABILITY ) ) {
            wp_die( esc_html__( 'Δεν έχετε δικαίωμα να αλλάξετε αυτές τις ρυθμίσεις.', 'panachaiko-trails' ), '', array( 'response' => 403 ) );
        }
        check_admin_referer( 'panachaiko_update_homepage' );

        $next = self::defaults();
        $next['home_category'] = isset( $_POST['home_category'] ) ? absint( $_POST['home_category'] ) : 0;

        foreach ( array_keys( self::PANELS ) as $panel ) {
            $count = isset( $_POST[ $panel . '_count' ] ) ? absint( $_POST[ $panel . '_count' ] ) : 4;
            $next[ $panel . '_count' ] = max( 1, min( 12, $count ) );

            $image_id = isset( $_POST[ $panel . '_image_id' ] ) ? absint( $_POST[ $panel . '_image_id' ] ) : 0;
            $next[ $panel . '_image_id' ] = $image_id && wp_attachment_is_image( $image_id ) ? $image_id : 0;
        }

        update_option( self::OPTION, $next, false );

        wp_safe_redirect( add_query_arg(
            array( 'page' => 'panachaiko-homepage', 'homepage_updated' => '1' ),
            admin_url( 'admin.php' )
        ) );
        exit;
    }

    public static function register_rest_routes(): void {
        register_rest_route(
            'panachaiko/v1',
            '/homepage',
            array(
                'methods' => WP_REST_Server::READABLE,
                'callback' => array( __CLASS__, 'get_homepage' ),
                'permission_callback' => '__return_true',
            )
        );
    }

    public static function get_homepage( WP_REST_Request $request ): WP_REST_Response {
        $settings = self::settings();
        $panels = array();

        foreach ( array_keys( self::PANELS ) as $panel ) {
            $image_id = absint( $settings[ $panel . '_image_id' ] );
            $image_url = $image_id ? wp_get_attachment_image_url( $image_id, 'full' ) : false;
            $panels[ $panel ] = array(
                'count' => (int) $settings[ $panel . '_count' ],
                'background_image' => $image_url ?: self::FALLBACK_IMAGES[ $panel ],
                'items' => self::items_for_panel( $panel, (int) $settings[ $panel . '_count' ], $settings ),
            );
        }

        $response = rest_ensure_response( array(
            'updated_at' => current_time( 'mysql', true ),
            'panels' => $panels,
        ) );
        $response->header( 'Cache-Control', 'public, max-age=60, stale-while-revalidate=300' );
        return $response;
    }

    private static function items_for_panel( string $panel, int $count, array $settings ): array {
        if ( 'home' === $panel ) {
            $args = array(
                'post_type' => 'post',
                'post_status' => 'publish',
                'posts_per_page' => $count,
                'orderby' => 'date',
                'order' => 'DESC',
            );
            if ( ! empty( $settings['home_category'] ) ) $args['cat'] = absint( $settings['home_category'] );
            return self::format_posts( get_posts( $args ), 'Άρθρο' );
        }

        if ( 'trails' === $panel ) {
            return self::format_posts( get_posts( array(
                'post_type' => 'trail',
                'post_status' => 'publish',
                'posts_per_page' => $count,
                'orderby' => 'date',
                'order' => 'DESC',
            ) ), 'Μονοπάτι' );
        }

        if ( 'poi' === $panel ) {
            $posts = get_posts( array(
                'post_type' => 'trail_poi',
                'post_status' => 'publish',
                'posts_per_page' => $count * 3,
                'orderby' => 'date',
                'order' => 'DESC',
                'meta_query' => array(
                    array( 'key' => 'content_type', 'value' => 'note' ),
                ),
            ) );
            $posts = array_values( array_filter( $posts, static function( WP_Post $post ): bool {
                return 'shelter' !== (string) get_post_meta( $post->ID, 'poi_type', true );
            } ) );
            return self::format_posts( array_slice( $posts, 0, $count ), 'Σημείο' );
        }

        if ( 'shelter' === $panel ) {
            return self::format_posts( get_posts( array(
                'post_type' => 'trail_poi',
                'post_status' => 'publish',
                'posts_per_page' => $count,
                'orderby' => 'date',
                'order' => 'DESC',
                'meta_query' => array(
                    array( 'key' => 'poi_type', 'value' => 'shelter' ),
                ),
            ) ), 'Καταφύγιο' );
        }

        if ( 'photos' === $panel ) {
            $media = get_posts( array(
                'post_type' => 'attachment',
                'post_status' => 'inherit',
                'post_mime_type' => 'image',
                'posts_per_page' => $count,
                'orderby' => 'date',
                'order' => 'DESC',
            ) );
            if ( $media ) return self::format_media( $media, 'Φωτογραφία' );

            return self::format_posts( get_posts( array(
                'post_type' => 'trail_poi',
                'post_status' => 'publish',
                'posts_per_page' => $count,
                'orderby' => 'date',
                'order' => 'DESC',
                'meta_query' => array(
                    array( 'key' => 'content_type', 'value' => 'photo' ),
                ),
            ) ), 'Φωτογραφία' );
        }

        if ( 'video' === $panel ) {
            $media = get_posts( array(
                'post_type' => 'attachment',
                'post_status' => 'inherit',
                'post_mime_type' => 'video',
                'posts_per_page' => $count,
                'orderby' => 'date',
                'order' => 'DESC',
            ) );
            if ( $media ) return self::format_media( $media, 'Βίντεο' );

            return self::format_posts( get_posts( array(
                'post_type' => 'trail_poi',
                'post_status' => 'publish',
                'posts_per_page' => $count,
                'orderby' => 'date',
                'order' => 'DESC',
                'meta_query' => array(
                    array( 'key' => 'content_type', 'value' => 'video' ),
                ),
            ) ), 'Βίντεο' );
        }

        return array();
    }

    private static function format_media( array $posts, string $kind ): array {
        return array_map( static function( WP_Post $post ) use ( $kind ): array {
            $title = get_the_title( $post );
            if ( '' === trim( $title ) ) $title = wp_basename( get_attached_file( $post->ID ) ?: (string) $post->guid );

            $image = wp_attachment_is_image( $post->ID )
                ? wp_get_attachment_image_url( $post->ID, 'medium' )
                : null;

            return array(
                'id' => $post->ID,
                'title' => $title,
                'meta' => $kind . ' · ' . get_the_date( 'd/m/Y', $post ),
                'image' => $image ?: null,
                'media_url' => wp_get_attachment_url( $post->ID ) ?: null,
            );
        }, $posts );
    }

    private static function format_posts( array $posts, string $kind ): array {
        return array_map( static function( WP_Post $post ) use ( $kind ): array {
            $image = get_the_post_thumbnail_url( $post, 'medium' );

            if ( ! $image && 'trail_poi' === $post->post_type ) {
                $media_ids = array_values( array_filter( array_map( 'absint', (array) get_post_meta( $post->ID, 'media_ids', true ) ) ) );
                if ( $media_ids ) {
                    $candidate = wp_get_attachment_image_url( $media_ids[0], 'medium' );
                    if ( $candidate ) $image = $candidate;
                }
            }

            $meta = $kind;
            if ( 'trail' === $post->post_type ) {
                $length = get_post_meta( $post->ID, 'length_km', true );
                $meta = $length !== '' ? $kind . ' · ' . number_format_i18n( (float) $length, 1 ) . ' χλμ' : $kind;
            } elseif ( 'trail_poi' === $post->post_type ) {
                $trail_id = absint( get_post_meta( $post->ID, 'related_trail', true ) );
                $trail_title = $trail_id ? get_the_title( $trail_id ) : '';
                if ( $trail_title ) $meta .= ' · ' . $trail_title;
            } elseif ( 'post' === $post->post_type ) {
                $meta = get_the_date( 'd/m/Y', $post );
            }

            return array(
                'id' => $post->ID,
                'title' => get_the_title( $post ),
                'meta' => $meta,
                'image' => $image ?: null,
            );
        }, $posts );
    }
}
