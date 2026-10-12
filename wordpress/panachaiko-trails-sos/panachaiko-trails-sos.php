<?php
/**
 * Plugin Name: Panachaiko Trails SOS Email
 * Description: Signed SOS email requests through the existing WordPress SMTP service. Set PT_SOS_SHARED_SECRET in wp-config.php and SOS_SHARED_SECRET in Vercel to the same random secret.
 * Version: 1.1.0
 */
if (!defined('ABSPATH')) exit;
function pt_sos_shared_secret() {
 return defined('PT_SOS_SHARED_SECRET') ? PT_SOS_SHARED_SECRET : (string)get_option('pt_sos_shared_secret', '');
}
register_activation_hook(__FILE__, function () {
 if (!get_option('pt_sos_shared_secret')) add_option('pt_sos_shared_secret', wp_generate_password(64, false, false), '', false);
});
add_action('admin_menu', function () {
 add_options_page('Panachaiko SOS', 'Panachaiko SOS', 'manage_options', 'panachaiko-sos', function () {
  if (!current_user_can('manage_options')) return;
  echo '<div class="wrap"><h1>Panachaiko SOS — Σύνδεση email</h1><p>Τα μηνύματα αποστέλλονται μέσω wp_mail και του υπάρχοντος SMTP του WordPress.</p><p>Αντιγράψτε το παρακάτω κλειδί στη μεταβλητή <code>SOS_SHARED_SECRET</code> του Vercel (Production και Preview) και κάντε νέα ανάπτυξη. Μην κοινοποιήσετε το κλειδί.</p><input type="password" readonly autocomplete="off" style="width:100%;max-width:650px" value="'.esc_attr(pt_sos_shared_secret()).'" aria-label="Κλειδί σύνδεσης SOS"><p><button type="button" class="button" onclick="var i=this.parentNode.previousElementSibling;i.type=i.type===\'password\'?\'text\':\'password\'">Εμφάνιση / Απόκρυψη</button></p><p>Το ίδιο SMTP εξυπηρετεί τη φόρμα επικοινωνίας και το SOS. Η αποδοχή από SMTP δεν επιβεβαιώνει παραλαβή από την επαφή.</p></div>';
 });
});
add_action('rest_api_init', function () {
 register_rest_route('panachaiko/v1', '/sos', array('methods'=>'POST','permission_callback'=>function($request){
  if (strlen(pt_sos_shared_secret())<32) return new WP_Error('sos_not_configured','SOS is not configured',array('status'=>503));
  $signature=$request->get_header('x-pt-sos-signature');
  if (!$signature || !hash_equals(hash_hmac('sha256',$request->get_body(),pt_sos_shared_secret()),$signature)) return new WP_Error('sos_forbidden','Invalid signature',array('status'=>403));
  return true;
 },'callback'=>function($request){
  $p=$request->get_json_params();
  $email=sanitize_email($p['email']??''); $lat=$p['latitude']??null; $lng=$p['longitude']??null;
  if (!is_email($email)||!is_numeric($lat)||!is_numeric($lng)||abs($lat)>90||abs($lng)>180||!is_numeric($p['accuracy']??null)||$p['accuracy']<0||!is_numeric($p['timestamp']??null)||$p['timestamp']<=0) return new WP_Error('sos_invalid','Invalid position or recipient',array('status'=>400));
  if (!is_numeric($p['sentAt']??null)||abs(time()-$p['sentAt']/1000)>60) return new WP_Error('sos_expired','Expired request',array('status'=>400));
  $id='pt_sos_request_'.hash('sha256',(string)($p['requestId']??''));
  if (get_transient($id)) return new WP_Error('sos_duplicate','Duplicate request',array('status'=>409));
  $key='pt_sos_rate_'.hash('sha256',(string)($p['ip']??'unknown')); $count=(int)get_transient($key);
  if ($count>=3) return new WP_Error('sos_rate','Too many attempts',array('status'=>429));
  set_transient($key,$count+1,10*MINUTE_IN_SECONDS); set_transient($id,1,5*MINUTE_IN_SECONDS);
  $name=sanitize_text_field($p['name']??'Πεζοπόρος'); $trail=sanitize_text_field($p['trail']??'');
  $date=wp_date('d/m/Y H:i:s T',(int)($p['timestamp']/1000));
  $message="SOS — Χρειάζομαι βοήθεια.\n\nΌνομα: $name\nΣυντεταγμένες: $lat, $lng\nhttps://www.google.com/maps?q=$lat,$lng\nΏρα στίγματος: $date\nΑκρίβεια GPS: ±".round($p['accuracy'])." μ.\nΔιαδρομή: $trail\n\nΤο μήνυμα κοινοποιήθηκε από τον χρήστη του Panachaiko Trails. Δεν αποτελεί ειδοποίηση υπηρεσίας διάσωσης.";
  if (!wp_mail($email,'SOS — Θέση πεζοπόρου | Panachaiko Trails',$message,array('Content-Type: text/plain; charset=UTF-8'))) return new WP_Error('sos_mail_failed','Email failed',array('status'=>502));
  return rest_ensure_response(array('ok'=>true));
 }));
});
