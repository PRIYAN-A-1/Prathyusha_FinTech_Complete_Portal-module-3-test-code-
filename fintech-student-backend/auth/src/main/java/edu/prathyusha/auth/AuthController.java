package edu.prathyusha.auth;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import java.util.concurrent.*;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
@RestController
public class AuthController {
 final JdbcTemplate db;final PasswordEncoder encoder;final TransactionTemplate tx;
 final String internalKey;final String dummy;final SecureRandom random=new SecureRandom();
 final ConcurrentHashMap<String,Window> attempts=new ConcurrentHashMap<>();
 record Window(long start,int count){}
 AuthController(JdbcTemplate db,PasswordEncoder encoder,TransactionTemplate tx){this.db=db;this.encoder=encoder;this.tx=tx;this.internalKey=System.getenv("AUTH_INTERNAL_KEY");if(internalKey==null||internalKey.length()<32)throw new IllegalStateException("AUTH_INTERNAL_KEY must have at least 32 characters");dummy=encoder.encode(UUID.randomUUID().toString());}
 static ResponseStatusException denied(){return new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Invalid credentials or unavailable membership");}
 static String hash(String token){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));}catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
 static String bearer(String header){if(header==null||!header.matches("Bearer [A-Za-z0-9_-]{43}"))throw denied();return header.substring(7);}
 void throttle(String remote){long now=System.currentTimeMillis();if(attempts.size()>10000)attempts.entrySet().removeIf(e->now-e.getValue().start>60000);if(attempts.size()>20000)throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS);Window w=attempts.compute(remote,(k,v)->v==null||now-v.start>60000?new Window(now,1):new Window(v.start,v.count+1));if(w.count>30)throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS);}
 @PostMapping("/auth/login") Map<String,Object> login(@RequestBody Map<String,String> b,jakarta.servlet.http.HttpServletRequest req){
 throttle(req.getRemoteAddr());String email=b.getOrDefault("email","").toLowerCase(Locale.ROOT).trim(),password=b.getOrDefault("password","");if(email.length()>254||password.getBytes(StandardCharsets.UTF_8).length>72||password.isEmpty())throw denied();
 // Persist failure counters even when login is rejected: no exception is thrown inside the transaction.
 Map<String,Object> result=tx.execute(t->{var rows=db.queryForList("SELECT * FROM users WHERE email=? FOR UPDATE",email);if(rows.isEmpty()){encoder.matches(password,dummy);return null;}var u=rows.get(0);var locked=(java.sql.Timestamp)u.get("locked_until");if(locked!=null&&locked.toInstant().isAfter(Instant.now()))return null;
 if(!encoder.matches(password,(String)u.get("password_hash"))){db.update("UPDATE users SET failed_attempts=failed_attempts+1,locked_until=CASE WHEN failed_attempts+1>=5 THEN now()+interval '15 minutes' ELSE NULL END WHERE id=?",u.get("id"));db.update("INSERT INTO audit_logs(actor_id,action,target_id) VALUES(?,'LOGIN_FAILED',?)",u.get("id"),u.get("id").toString());return null;}
 if(!"APPROVED".equals(u.get("membership_status")))return null;
 byte[] bytes=new byte[32];random.nextBytes(bytes);String token=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
 db.update("DELETE FROM sessions WHERE expires_at<=now()");db.update("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,now()+interval '8 hours')",hash(token),u.get("id"));db.update("UPDATE users SET failed_attempts=0,locked_until=NULL WHERE id=?",u.get("id"));db.update("INSERT INTO audit_logs(actor_id,action,target_id) VALUES(?,'LOGIN_SUCCEEDED',?)",u.get("id"),u.get("id").toString());return Map.<String,Object>of("access_token",token,"token_type","Bearer","expires_in",28800,"user",Map.of("id",u.get("id"),"role",u.get("role")));});if(result==null)throw denied();return result;
 }
 Map<String,Object> session(String header){var rows=db.queryForList("SELECT u.id,u.role,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>now() AND u.membership_status='APPROVED'",hash(bearer(header)));if(rows.isEmpty())throw denied();return rows.get(0);}
 @GetMapping("/internal/introspect") Map<String,Object> introspect(@RequestHeader(value="X-Internal-Key",required=false)String key,@RequestHeader(value="Authorization",required=false)String header){if(key==null||!MessageDigest.isEqual(internalKey.getBytes(StandardCharsets.UTF_8),key.getBytes(StandardCharsets.UTF_8)))throw denied();return session(header);}
 @PostMapping("/auth/logout") Map<String,Boolean> logout(@RequestHeader(value="Authorization",required=false)String header){db.update("DELETE FROM sessions WHERE token_hash=?",hash(bearer(header)));return Map.of("ok",true);}
 @PostMapping("/auth/password") Map<String,Boolean> password(@RequestHeader(value="Authorization",required=false)String header,@RequestBody Map<String,String>b){var me=session(header);String old=b.getOrDefault("current_password",""),next=b.getOrDefault("new_password","");if(next.length()<12||next.getBytes(StandardCharsets.UTF_8).length>72)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Use 12 to 72 password bytes");tx.executeWithoutResult(t->{String stored=db.queryForObject("SELECT password_hash FROM users WHERE id=? FOR UPDATE",String.class,me.get("id"));if(old.getBytes(StandardCharsets.UTF_8).length>72||!encoder.matches(old,stored))throw denied();db.update("UPDATE users SET password_hash=? WHERE id=?",encoder.encode(next),me.get("id"));db.update("DELETE FROM sessions WHERE user_id=?",me.get("id"));db.update("INSERT INTO audit_logs(actor_id,action,target_id) VALUES(?,'PASSWORD_CHANGED',?)",me.get("id"),me.get("id").toString());});return Map.of("ok",true);}
}
