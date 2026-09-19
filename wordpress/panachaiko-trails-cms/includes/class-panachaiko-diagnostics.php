<?php
if ( ! defined( 'ABSPATH' ) ) exit;

final class Panachaiko_Trails_Diagnostics {
    private const TEST_META = '_panachaiko_diagnostic_test';

    public static function init(): void {
        add_action( 'admin_menu', array( __CLASS__, 'admin_menu' ) );
    }

    public static function admin_menu(): void {
        add_management_page(
            'Panachaiko Trails Έλεγχος',
            'Panachaiko Trails Έλεγχος',
            'manage_options',
            'panachaiko-trails-diagnostics',
            array( __CLASS__, 'render' )
        );
    }

    private static function trail_id( string $code ): int {
        $ids = get_posts( array(
            'post_type'=>'trail','post_status'=>'any','posts_per_page'=>1,
            'meta_key'=>'trail_code','meta_value'=>$code,'fields'=>'ids'
        ) );
        return $ids ? (int) $ids[0] : 0;
    }

    private static function temp_file( string $suffix, string $base64 ): string {
        $path = wp_tempnam( 'panachaiko-test-' . $suffix );
        if ( ! $path ) return '';
        file_put_contents( $path, base64_decode( $base64 ) );
        return $path;
    }

    private static function submit_test( string $type ): array {
        $request = new WP_REST_Request( 'POST', '/panachaiko/v1/submissions' );
        $request->set_body_params( array(
            'trail_code'   => 'Π-3',
            'content_type' => $type,
            'category'     => 'general',
            'title'        => '[TEST] ' . strtoupper( $type ) . ' V1',
            'text'         => 'Αυτόματη δοκιμή Panachaiko Trails V1 — μπορεί να διαγραφεί.',
            'lat'          => 38.22888,
            'lng'          => 21.79129,
            'website'      => '',
        ) );

        $tmp = '';
        if ( 'photo' === $type ) {
            $tmp = self::temp_file( 'photo.png', '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' );
            $request->set_file_params( array( 'file'=>array(
                'name'=>'panachaiko-test-photo.png','type'=>'image/png','tmp_name'=>$tmp,'error'=>0,'size'=>filesize($tmp)
            ) ) );
        } elseif ( 'video' === $type ) {
            $tmp = self::temp_file( 'video.mp4', 'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAPWbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAAggAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAwF0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAAggAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAKAAAABaAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAIIAAAEAAABAAAAAAJ5bWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAyAAAAGgBVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAACJG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAeRzdGJsAAAAwHN0c2QAAAAAAAAAAQAAALBhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAKAAWgBIAAAASAAAAAAAAAABFUxhdmM2MS4xOS4xMDEgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAANmF2Y0MBZAAL/+EAGWdkAAus2UKN+TARAAADAAEAAAMAMg8UKZYBAAZo6+PLIsD9+PgAAAAAEHBhc3AAAAABAAAAAQAAABRidHJ0AAAAAAAAa+4AAAAAAAAAGHN0dHMAAAAAAAAAAQAAAA0AAAIAAAAAFHN0c3MAAAAAAAAAAQAAAAEAAAB4Y3R0cwAAAAAAAAANAAAAAQAABAAAAAABAAAKAAAAAAEAAAQAAAAAAQAAAAAAAAABAAACAAAAAAEAAAoAAAAAAQAABAAAAAABAAAAAAAAAAEAAAIAAAAAAQAACgAAAAABAAAEAAAAAAEAAAAAAAAAAQAAAgAAAAAcc3RzYwAAAAAAAAABAAAAAQAAAA0AAAABAAAASHN0c3oAAAAAAAAAAAAAAA0AAAY0AAAALAAAABAAAAAQAAAADAAAABUAAAAPAAAADAAAAAwAAAAVAAAADwAAAAwAAAAMAAAAFHN0Y28AAAAAAAAAAQAABAYAAABhdWR0YQAAAFltZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAACxpbHN0AAAAJKl0b28AAAAcZGF0YQAAAAEAAAAATGF2ZjYxLjcuMTAzAAAACGZyZWUAAAcMbWRhdAAAAq4GBf//qtxF6b3m2Ui3lizYINkj7u94MjY0IC0gY29yZSAxNjQgcjMxMDggMzFlMTlmOSAtIEguMjY0L01QRUctNCBBVkMgY29kZWMgLSBDb3B5bGVmdCAyMDAzLTIwMjMgLSBodHRwOi8vd3d3LnZpZGVvbGFuLm9yZy94MjY0Lmh0bWwgLSBvcHRpb25zOiBjYWJhYz0xIHJlZj0zIGRlYmxvY2s9MTowOjAgYW5hbHlzZT0weDM6MHgxMTMgbWU9aGV4IHN1Ym1lPTcgcHN5PTEgcHN5X3JkPTEuMDA6MC4wMCBtaXhlZF9yZWY9MSBtZV9yYW5nZT0xNiBjaHJvbWFfbWU9MSB0cmVsbGlzPTEgOHg4ZGN0PTEgY3FtPTAgZGVhZHpvbmU9MjEsMTEgZmFzdF9wc2tpcD0xIGNocm9tYV9xcF9vZmZzZXQ9LTIgdGhyZWFkcz0zIGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MyBiX3B5cmFtaWQ9MiBiX2FkYXB0PTEgYl9iaWFzPTAgZGlyZWN0PTEgd2VpZ2h0Yj0xIG9wZW5fZ29wPTAgd2VpZ2h0cD0yIGtleWludD0yNTAga2V5aW50X21pbj0yNSBzY2VuZWN1dD00MCBpbnRyYV9yZWZyZXNoPTAgcmNfbG9va2FoZWFkPTQwIHJjPWNyZiBtYnRyZWU9MSBjcmY9MjMuMCBxY29tcD0wLjYwIHFwbWluPTAgcXBtYXg9NjkgcXBzdGVwPTQgaXBfcmF0aW89MS40MCBhcT0xOjEuMDAAgAAAA35liIQAO//+906/AptUwioDklcK9sqkJlm5U3w+xrIXRFB/Wc32HFA2E9QAtXasY74+0gWLuc3mVkHBcwlA9H45p5KCj3DehpXdtdRvSSmdx5lZOo3k+uhec5eaKXBKFAY7fa36oeXYmBKvVaJiVYliUZAWqBlfpm8BPJ/J+s1poxdIdvqej5mVLW7KJGNptY+lU7ruXUPvrjl4lWAawVN5dGCdUqdG51kNE2KwpJesXSX7HfqAJlx7bcdJroN16eGaLk+ZfyVx9KJWy8U7bamvJP2j/h0B7IlKMWcsAdKg9yIru8MEtHYXoadZVMd8pS3pHQoY10n0VcLtGj9+Ozu8BVYr9t9lFn6GTJCXJ9nsCWeEUB74UdmwTKC+R2Thmo/3YcOb/cgD/6UYBgyA8jnM+thbCLoRq8vZ8/3Nt94jvsMW1qxkuOMtcwEmiE1CJ9lBdRDuhhBlmEFSppqqtrb+7y1vsp/fDpoLOXj7v3HM9r/CFoKOdbpS0+UrNms4bP/Nn8tnRRAxqu0buo6HdtDRV8LbiwIfr3p3nbiGDtzTBnfds1UtfeOUKhhNBifdtDcmb7SUhdgU2hkDNgK5gq+yut2ZLL1Km/V5Y5AMpjCUQIhX4O8LeHFSwITF2w3Q/YmnSWw56bjJ8SCXjjK3yfO/s+ryrsW+ocoQPlhvhwR1rdEFfp12oXRv9ELIuij7/oxpYYqJp9pxL0dGggcvsjlNs5WISUoMtDCPSO8Ci+J7w0qQV8wI+G9PZflI/KidfyqgIRGwh1lA4SeV/IDPD7x0x8J7GQBYSxW3292pWQWQBg+YaNcUU0U806RymRfq+M5ek2IiUE1RtpvqX+hMCsSOLahSeWQlcBweeqG4eewHsC2uwJiKZOd4ZZ8j7FE5uR4dtlFdB1cIw6WbH1lcJQ5whL37IEUhHNmrNDcsf9featlwFDJtzXT9sGZBVkVfWXp5F4REb3lx2+oKZGi7XD4qtGf/D/C4TPaskgIom5CpMRzP4ria+Opt7oODw8NbVxWoP/4dQs8NsoBh7+oyqxyf5cMsxjTt6Pfx3SI7GI1O45khHsQdM8ETG+DVbTsCAHMJaqPEyTSVN/7isW+B7HOXk0eGyntF6MtpNo0RYwk8HPBv2+HWlWupHdbPvdYPn1zYjPRw6BH6+7F6xP2Ms6HN+Edjt7HU/rSm8FosGbEAAAAoQZokbEN//qeEEYbqkANtWveuqlsPMA78tZNZspwWw4gkQO7B/G+22gAAAAxBnkJ4hf8COHM6XZEAAAAMAZ5hdEK/Au0tjp2QAAAACAGeY2pCvwFTAAAAEUGaaEmoQWiZTAhn//6eEAbNAAAAC0GehkURLC//APOBAAAACAGepXRCvwFTAAAACAGep2pCvwFTAAAAEUGarEmoQWyZTAhX//44QBowAAAAC0GeykUVLC//APOBAAAACAGe6XRCvwFTAAAACAGe62pCvwFT' );
            $request->set_file_params( array( 'file'=>array(
                'name'=>'panachaiko-test-video.mp4','type'=>'video/mp4','tmp_name'=>$tmp,'error'=>0,'size'=>filesize($tmp)
            ) ) );
        }

        $response = rest_do_request( $request );
        if ( $tmp && file_exists( $tmp ) ) @unlink( $tmp );
        $data = $response->get_data();
        if ( $response->get_status() >= 400 ) {
            return array( 'ok'=>false, 'message'=>is_array($data) ? (string)($data['message'] ?? 'REST error') : 'REST error' );
        }
        $id = isset( $data['id'] ) ? (int) $data['id'] : 0;
        if ( $id ) update_post_meta( $id, self::TEST_META, 1 );
        return array( 'ok'=>true, 'id'=>$id );
    }

    private static function test_ids(): array {
        return array_map( 'intval', get_posts( array(
            'post_type'=>'trail_poi','post_status'=>'any','posts_per_page'=>-1,
            'meta_key'=>self::TEST_META,'meta_value'=>1,'fields'=>'ids'
        ) ) );
    }

    private static function public_api_test_ids(): array {
        $request = new WP_REST_Request( 'GET', '/panachaiko/v1/trails/%CE%A0-3' );
        $request->set_param( 'code', 'Π-3' );
        $response = Panachaiko_Trails_REST::get_trail( $request );
        if ( is_wp_error( $response ) ) return array();
        $data = $response->get_data();
        $trail = is_array($data) ? ($data['trail'] ?? array()) : array();
        $ids = array();
        foreach ( array('notes','photos','videos') as $group ) {
            foreach ( (array)($trail[$group] ?? array()) as $poi ) if ( isset($poi['id']) ) $ids[]=(int)$poi['id'];
        }
        return $ids;
    }

    private static function handle_actions(): string {
        if ( 'POST' !== ($_SERVER['REQUEST_METHOD'] ?? '') || empty($_POST['panachaiko_diag_action']) ) return '';
        check_admin_referer( 'panachaiko_diagnostics' );
        $action = sanitize_key( (string) $_POST['panachaiko_diag_action'] );

        if ( 'repair_navigation' === $action ) {
            foreach ( Panachaiko_Trails_Migrations::navigation_map() as $code=>$unused ) {
                $trail_id=self::trail_id($code);
                if($trail_id) Panachaiko_Trails_Migrations::seed_navigation_for_trail($trail_id,$code);
            }
            return 'Έγινε επανέλεγχος/συμπλήρωση των Α/Τ.';
        }

        if ( 'create_tests' === $action ) {
            $created=array();
            foreach(array('note','photo','video') as $type) $created[$type]=self::submit_test($type);
            $ok=count(array_filter($created,static fn($r)=>!empty($r['ok'])));
            return 'Δημιουργήθηκαν ' . $ok . '/3 πραγματικές REST υποβολές ως pending.';
        }

        if ( 'publish_tests' === $action ) {
            $count=0;
            foreach(self::test_ids() as $id) {
                if('pending'===get_post_status($id)) { wp_update_post(array('ID'=>$id,'post_status'=>'publish')); $count++; }
            }
            return 'Εγκρίθηκαν ' . $count . ' δοκιμαστικές υποβολές.';
        }

        if ( 'delete_tests' === $action ) {
            $count=0;
            foreach(self::test_ids() as $id) {
                $media=(array)get_post_meta($id,'media_ids',true);
                foreach($media as $media_id) if($media_id) wp_delete_attachment((int)$media_id,true);
                wp_delete_post($id,true); $count++;
            }
            return 'Διαγράφηκαν ' . $count . ' δοκιμαστικές εγγραφές και τα συνημμένα τους.';
        }
        return '';
    }

    public static function render(): void {
        if ( ! current_user_can( 'manage_options' ) ) return;
        $notice=self::handle_actions();
        $expected=Panachaiko_Trails_Migrations::navigation_map();
        $rows=array();
        foreach($expected as $code=>$cfg) {
            $id=self::trail_id($code);
            $actual=$id ? array(
                'start_lat'=>get_post_meta($id,'start_lat',true),
                'start_lng'=>get_post_meta($id,'start_lng',true),
                'start_label'=>(string)get_post_meta($id,'start_label',true),
                'end_lat'=>get_post_meta($id,'end_lat',true),
                'end_lng'=>get_post_meta($id,'end_lng',true),
                'end_label'=>(string)get_post_meta($id,'end_label',true),
                'verified'=>(bool)get_post_meta($id,'direction_verified',true),
            ) : array();
            $complete=$id && is_numeric($actual['start_lat']) && is_numeric($actual['start_lng']) && is_numeric($actual['end_lat']) && is_numeric($actual['end_lng']) && $actual['start_label'] && $actual['end_label'];
            $matches=$complete
                && abs((float)$actual['start_lat']-(float)$cfg['start_lat'])<0.00001
                && abs((float)$actual['start_lng']-(float)$cfg['start_lng'])<0.00001
                && abs((float)$actual['end_lat']-(float)$cfg['end_lat'])<0.00001
                && abs((float)$actual['end_lng']-(float)$cfg['end_lng'])<0.00001;
            $rows[]=compact('code','id','actual','complete','matches');
        }

        $test_ids=self::test_ids();
        $public_ids=self::public_api_test_ids();
        $test_rows=array();
        foreach($test_ids as $id) {
            $media=array_values(array_filter(array_map('absint',(array)get_post_meta($id,'media_ids',true))));
            $test_rows[]=array(
                'id'=>$id,'status'=>get_post_status($id),'type'=>(string)get_post_meta($id,'content_type',true),
                'trail'=>(string)get_post_meta($id,'trail_code_snapshot',true),'media'=>$media,
                'public'=>in_array($id,$public_ids,true)
            );
        }
        ?>
        <div class="wrap">
          <h1>Panachaiko Trails — Έλεγχος V1</h1>
          <p><strong>Plugin:</strong> <?php echo esc_html(PANACHAIKO_TRAILS_VERSION); ?> · <strong>Schema:</strong> <?php echo esc_html((string)get_option('panachaiko_trails_schema_version','—')); ?></p>
          <?php if($notice): ?><div class="notice notice-success"><p><?php echo esc_html($notice); ?></p></div><?php endif; ?>

          <h2>1. Έλεγχος Α/Τ — 13 μονοπάτια</h2>
          <form method="post"><?php wp_nonce_field('panachaiko_diagnostics'); ?><input type="hidden" name="panachaiko_diag_action" value="repair_navigation"><button class="button button-primary">Επανέλεγχος / συμπλήρωση Α/Τ</button></form>
          <table class="widefat striped" style="margin-top:12px"><thead><tr><th>Κωδικός</th><th>Αφετηρία Α</th><th>Τέλος Τ</th><th>Συντεταγμένες</th><th>Κατάσταση</th></tr></thead><tbody>
          <?php foreach($rows as $row): $a=$row['actual']; ?>
            <tr><td><strong><?php echo esc_html($row['code']); ?></strong></td>
              <td><?php echo esc_html($a['start_label'] ?? '—'); ?></td>
              <td><?php echo esc_html($a['end_label'] ?? '—'); ?></td>
              <td><?php echo isset($a['start_lat']) ? esc_html($a['start_lat'].' / '.$a['start_lng'].' → '.$a['end_lat'].' / '.$a['end_lng']) : '—'; ?></td>
              <td><?php echo $row['complete'] && $row['matches'] ? '<span style="color:#15803d;font-weight:700">✓ OK</span>' : '<span style="color:#b91c1c;font-weight:700">✗ Θέλει έλεγχο</span>'; ?></td>
            </tr>
          <?php endforeach; ?></tbody></table>

          <h2 style="margin-top:28px">2. Πραγματικό REST test περιεχομένου</h2>
          <p>Το τεστ δημιουργεί μέσω του ίδιου REST endpoint της εφαρμογής μία περιγραφή, μία PNG φωτογραφία και ένα μικρό MP4 βίντεο στην Π-3. Όλα δημιουργούνται ως <code>pending</code>.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <form method="post"><?php wp_nonce_field('panachaiko_diagnostics'); ?><input type="hidden" name="panachaiko_diag_action" value="create_tests"><button class="button button-primary">Δημιουργία 3 pending tests</button></form>
            <form method="post"><?php wp_nonce_field('panachaiko_diagnostics'); ?><input type="hidden" name="panachaiko_diag_action" value="publish_tests"><button class="button">Έγκριση test υποβολών</button></form>
            <form method="post"><?php wp_nonce_field('panachaiko_diagnostics'); ?><input type="hidden" name="panachaiko_diag_action" value="delete_tests"><button class="button" onclick="return confirm('Να διαγραφούν όλα τα test δεδομένα και τα αρχεία τους;')">Καθαρισμός tests</button></form>
          </div>
          <table class="widefat striped" style="margin-top:12px"><thead><tr><th>ID</th><th>Τύπος</th><th>Μονοπάτι</th><th>Status</th><th>Media Library</th><th>Δημόσιο API</th></tr></thead><tbody>
          <?php if(!$test_rows): ?><tr><td colspan="6">Δεν υπάρχουν test υποβολές.</td></tr><?php endif; ?>
          <?php foreach($test_rows as $r): ?>
            <tr><td><?php echo esc_html((string)$r['id']); ?></td><td><?php echo esc_html($r['type']); ?></td><td><?php echo esc_html($r['trail']); ?></td><td><?php echo esc_html($r['status']); ?></td>
            <td><?php echo $r['media'] ? '✓ #' . esc_html(implode(', #',$r['media'])) : ('note'===$r['type'] ? '—' : '✗'); ?></td>
            <td><?php echo $r['public'] ? '<span style="color:#15803d;font-weight:700">✓ εμφανίζεται</span>' : '<span style="color:#646970">όχι ακόμη</span>'; ?></td></tr>
          <?php endforeach; ?></tbody></table>
          <p style="margin-top:16px;color:#646970">Αναμενόμενο: pending → δεν εμφανίζεται δημόσια. Μετά την έγκριση → publish και ✓ εμφανίζεται στο δημόσιο API της Π-3.</p>
        </div>
        <?php
    }
}
