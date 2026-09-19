<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

final class Panachaiko_Trails_Submissions_Admin {
    private const PAGE_SLUG = 'panachaiko-user-submissions';

    public static function init(): void {
        add_action( 'admin_menu', array( __CLASS__, 'admin_menu' ) );
        add_action( 'admin_post_panachaiko_approve_submission', array( __CLASS__, 'approve_submission' ) );
    }

    public static function admin_menu(): void {
        $pending = self::count_submissions( 'pending' );
        $label = 'Υποβολές χρηστών';
        if ( $pending > 0 ) {
            $label .= ' <span class="awaiting-mod count-' . (int) $pending . '"><span class="pending-count">' . (int) $pending . '</span></span>';
        }

        add_submenu_page(
            'edit.php?post_type=trail_poi',
            'Υποβολές χρηστών',
            $label,
            'edit_posts',
            self::PAGE_SLUG,
            array( __CLASS__, 'render_page' )
        );
    }

    private static function count_submissions( string $status ): int {
        $query = new WP_Query( array(
            'post_type'      => 'trail_poi',
            'post_status'    => $status,
            'posts_per_page' => 1,
            'fields'         => 'ids',
            'meta_key'       => 'submission_source',
            'meta_value'     => 'public_map',
            'no_found_rows'  => false,
        ) );
        return (int) $query->found_posts;
    }

    private static function submission_query( string $status ): WP_Query {
        return new WP_Query( array(
            'post_type'      => 'trail_poi',
            'post_status'    => $status,
            'posts_per_page' => 50,
            'orderby'        => 'date',
            'order'          => 'DESC',
            'meta_key'       => 'submission_source',
            'meta_value'     => 'public_map',
        ) );
    }

    private static function status_from_request(): string {
        $status = isset( $_GET['submission_status'] )
            ? sanitize_key( wp_unslash( $_GET['submission_status'] ) )
            : 'pending';
        return in_array( $status, array( 'pending', 'publish' ), true ) ? $status : 'pending';
    }

    private static function type_label( string $type ): string {
        $labels = array(
            'photo' => '📷 Φωτογραφία',
            'video' => '🎥 Βίντεο',
            'note'  => '📝 Περιγραφή',
        );
        return $labels[ $type ] ?? '📍 Σημείο';
    }

    private static function trail_label( int $post_id ): string {
        $code = (string) get_post_meta( $post_id, 'trail_code_snapshot', true );
        $trail_id = absint( get_post_meta( $post_id, 'related_trail', true ) );
        if ( ! $code && $trail_id ) {
            $code = (string) get_post_meta( $trail_id, 'trail_code', true );
        }
        $name = $trail_id ? get_the_title( $trail_id ) : '';
        return trim( $code . ( $name ? ' — ' . $name : '' ), ' —' ) ?: '—';
    }

    private static function media_preview( int $post_id, string $type ): string {
        $ids = array_values( array_filter( array_map( 'absint', (array) get_post_meta( $post_id, 'media_ids', true ) ) ) );

        if ( 'photo' === $type ) {
            $media_id = $ids[0] ?? get_post_thumbnail_id( $post_id );
            if ( $media_id ) {
                $image = wp_get_attachment_image( $media_id, 'medium', false, array(
                    'style' => 'display:block;max-width:180px;height:auto;border-radius:8px;border:1px solid #dcdcde',
                    'loading' => 'lazy',
                ) );
                if ( $image ) return $image;
            }
            return '<span style="color:#b32d2e">Δεν βρέθηκε εικόνα</span>';
        }

        if ( 'video' === $type ) {
            if ( $ids ) {
                $url = wp_get_attachment_url( $ids[0] );
                if ( $url ) {
                    return '<video controls preload="metadata" style="display:block;width:220px;max-width:100%;max-height:135px;border-radius:8px;background:#111" src="' . esc_url( $url ) . '"></video>';
                }
            }
            $url = (string) get_post_meta( $post_id, 'external_video_url', true );
            if ( $url ) {
                return '<a href="' . esc_url( $url ) . '" target="_blank" rel="noopener">Άνοιγμα εξωτερικού βίντεο ↗</a>';
            }
            return '<span style="color:#b32d2e">Δεν βρέθηκε βίντεο</span>';
        }

        $content = trim( wp_strip_all_tags( (string) get_post_field( 'post_content', $post_id ) ) );
        if ( ! $content ) return '—';
        return '<div style="max-width:360px;white-space:normal;line-height:1.5">' . esc_html( wp_trim_words( $content, 34, '…' ) ) . '</div>';
    }

    private static function approve_url( int $post_id ): string {
        return wp_nonce_url(
            admin_url( 'admin-post.php?action=panachaiko_approve_submission&post_id=' . $post_id ),
            'panachaiko_approve_submission_' . $post_id
        );
    }

    public static function approve_submission(): void {
        $post_id = isset( $_GET['post_id'] ) ? absint( $_GET['post_id'] ) : 0;
        if ( ! $post_id || ! current_user_can( 'publish_posts' ) ) {
            wp_die( 'Δεν έχεις δικαίωμα έγκρισης αυτής της υποβολής.' );
        }

        check_admin_referer( 'panachaiko_approve_submission_' . $post_id );

        if ( 'trail_poi' !== get_post_type( $post_id ) || 'public_map' !== (string) get_post_meta( $post_id, 'submission_source', true ) ) {
            wp_die( 'Η εγγραφή δεν είναι υποβολή χρήστη του Panachaiko Trails.' );
        }

        wp_update_post( array(
            'ID'          => $post_id,
            'post_status' => 'publish',
        ) );
        update_post_meta( $post_id, 'verified_at', current_time( 'Y-m-d' ) );

        wp_safe_redirect( add_query_arg(
            array(
                'post_type'             => 'trail_poi',
                'page'                  => self::PAGE_SLUG,
                'submission_status'     => 'pending',
                'panachaiko_approved'   => 1,
            ),
            admin_url( 'edit.php' )
        ) );
        exit;
    }

    public static function render_page(): void {
        if ( ! current_user_can( 'edit_posts' ) ) return;

        $status = self::status_from_request();
        $query = self::submission_query( $status );
        $pending_count = self::count_submissions( 'pending' );
        $published_count = self::count_submissions( 'publish' );
        $base = admin_url( 'edit.php?post_type=trail_poi&page=' . self::PAGE_SLUG );
        ?>
        <div class="wrap">
            <h1>Υποβολές χρηστών</h1>
            <p>Εδώ εμφανίζονται μόνο όσα στάλθηκαν από τον δημόσιο χάρτη. Οι νέες υποβολές μένουν σε <strong>Αναμονή</strong> μέχρι να τις εγκρίνεις.</p>

            <?php if ( isset( $_GET['panachaiko_approved'] ) ) : ?>
                <div class="notice notice-success is-dismissible"><p><strong>Εγκρίθηκε.</strong> Η υποβολή είναι πλέον δημοσιευμένη και διαθέσιμη στο API του μονοπατιού.</p></div>
            <?php endif; ?>

            <nav class="nav-tab-wrapper" style="margin-bottom:16px">
                <a class="nav-tab <?php echo 'pending' === $status ? 'nav-tab-active' : ''; ?>" href="<?php echo esc_url( add_query_arg( 'submission_status', 'pending', $base ) ); ?>">Σε αναμονή <span class="count">(<?php echo (int) $pending_count; ?>)</span></a>
                <a class="nav-tab <?php echo 'publish' === $status ? 'nav-tab-active' : ''; ?>" href="<?php echo esc_url( add_query_arg( 'submission_status', 'publish', $base ) ); ?>">Εγκεκριμένες <span class="count">(<?php echo (int) $published_count; ?>)</span></a>
            </nav>

            <style>
                .panachaiko-submission-card{display:grid;grid-template-columns:minmax(180px,240px) 1fr auto;gap:18px;align-items:start;background:#fff;border:1px solid #dcdcde;border-radius:10px;padding:16px;margin:0 0 12px;box-shadow:0 1px 2px rgba(0,0,0,.03)}
                .panachaiko-submission-card h2{margin:0 0 8px;font-size:16px}
                .panachaiko-submission-meta{display:flex;flex-wrap:wrap;gap:7px 12px;color:#50575e;font-size:12px;margin-bottom:9px}
                .panachaiko-status{display:inline-block;padding:3px 8px;border-radius:999px;font-weight:600;background:#fff4cc;color:#7a5b00}
                .panachaiko-status.published{background:#e7f5ea;color:#166534}
                .panachaiko-actions{display:flex;flex-direction:column;gap:7px;min-width:125px}
                @media(max-width:900px){.panachaiko-submission-card{grid-template-columns:1fr}.panachaiko-actions{flex-direction:row;flex-wrap:wrap}}
            </style>

            <?php if ( ! $query->have_posts() ) : ?>
                <div class="notice notice-info inline"><p><?php echo 'pending' === $status ? 'Δεν υπάρχουν υποβολές σε αναμονή.' : 'Δεν υπάρχουν ακόμη εγκεκριμένες υποβολές χρηστών.'; ?></p></div>
            <?php endif; ?>

            <?php while ( $query->have_posts() ) : $query->the_post();
                $post_id = get_the_ID();
                $type = (string) get_post_meta( $post_id, 'content_type', true ) ?: 'note';
                $category = (string) get_post_meta( $post_id, 'poi_type', true ) ?: 'general';
                $lat = get_post_meta( $post_id, 'latitude', true );
                $lng = get_post_meta( $post_id, 'longitude', true );
                $submitted = (string) get_post_meta( $post_id, 'submitted_at', true );
                $edit_url = get_edit_post_link( $post_id, 'raw' );
                ?>
                <article class="panachaiko-submission-card">
                    <div><?php echo wp_kses_post( self::media_preview( $post_id, $type ) ); ?></div>
                    <div>
                        <h2><?php echo esc_html( get_the_title() ?: self::type_label( $type ) ); ?></h2>
                        <div class="panachaiko-submission-meta">
                            <span><strong><?php echo esc_html( self::type_label( $type ) ); ?></strong></span>
                            <span>Μονοπάτι: <strong><?php echo esc_html( self::trail_label( $post_id ) ); ?></strong></span>
                            <span>Κατηγορία: <?php echo esc_html( $category ); ?></span>
                            <?php if ( is_numeric( $lat ) && is_numeric( $lng ) ) : ?><span>📍 <?php echo esc_html( number_format_i18n( (float) $lat, 5 ) . ', ' . number_format_i18n( (float) $lng, 5 ) ); ?></span><?php endif; ?>
                            <?php if ( $submitted ) : ?><span>Υποβλήθηκε: <?php echo esc_html( $submitted ); ?> UTC</span><?php endif; ?>
                        </div>
                        <span class="panachaiko-status <?php echo 'publish' === $status ? 'published' : ''; ?>"><?php echo 'publish' === $status ? '✓ Εγκεκριμένη' : '● Σε αναμονή'; ?></span>
                        <?php if ( trim( (string) get_post_field( 'post_content', $post_id ) ) && 'note' !== $type ) : ?>
                            <p style="margin-bottom:0"><?php echo esc_html( wp_trim_words( wp_strip_all_tags( (string) get_post_field( 'post_content', $post_id ) ), 32, '…' ) ); ?></p>
                        <?php endif; ?>
                    </div>
                    <div class="panachaiko-actions">
                        <?php if ( 'pending' === $status && current_user_can( 'publish_posts' ) ) : ?>
                            <a class="button button-primary" href="<?php echo esc_url( self::approve_url( $post_id ) ); ?>">✓ Έγκριση</a>
                        <?php endif; ?>
                        <?php if ( $edit_url ) : ?><a class="button" href="<?php echo esc_url( $edit_url ); ?>">Έλεγχος / επεξεργασία</a><?php endif; ?>
                    </div>
                </article>
            <?php endwhile; wp_reset_postdata(); ?>
        </div>
        <?php
    }
}
