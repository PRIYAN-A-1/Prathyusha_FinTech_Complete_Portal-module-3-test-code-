package edu.prathyusha.auth;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
@RestController
public class AuthController {
 private final JdbcTemplate jdbc;private final BCryptPasswordEncoder passwords;
 private final String dummy;
 AuthController(JdbcTemplate j,BCryptPasswordEncoder p){jdbc=j;passwords=p;dummy=p.encode(UUID.randomUUID().toString());}
 record Login(@NotBlank @Email @Size(max=200) String email,@NotBlank @Size(min=1,max=72) String password){}
 @GetMapping("/health") public Map<String,Object> health(){jdbc.queryForObject("SELECT 1",Integer.class);return Map.of("status","ready");}
 @PostMapping("/auth/login") @Transactional
 public ResponseEntity<?> login(@Valid @RequestBody Login b){
  if(b.password().getBytes(java.nio.charset.StandardCharsets.UTF_8).length>72)return ResponseEntity.badRequest().body(Map.of("error","Invalid input"));
  String email=b.email().trim().toLowerCase(Locale.ROOT);
  jdbc.update("INSERT INTO auth_attempts(email,failures,window_start) VALUES(?,0,now()) ON CONFLICT(email) DO NOTHING",email);
  var a=jdbc.queryForMap("SELECT * FROM auth_attempts WHERE email=? FOR UPDATE",email);
  if(((java.sql.Timestamp)a.get("window_start")).toInstant().isBefore(Instant.now().minusSeconds(900))){jdbc.update("UPDATE auth_attempts SET failures=0,window_start=now() WHERE email=?",email);a.put("failures",0);}
  if(((Number)a.get("failures")).intValue()>=5)return ResponseEntity.status(429).header("Retry-After","900").body(Map.of("error","Try again later"));
  var users=jdbc.queryForList("SELECT id,password_hash,role,membership_status FROM users WHERE email=?",email);
  var u=users.isEmpty()?null:users.get(0);boolean valid=passwords.matches(b.password(),u==null?dummy:(String)u.get("password_hash"));
  if(!valid||u==null||!"APPROVED".equals(u.get("membership_status"))){jdbc.update("UPDATE auth_attempts SET failures=failures+1 WHERE email=?",email);return ResponseEntity.status(401).body(Map.of("error","Invalid credentials or unavailable account"));}
  jdbc.update("DELETE FROM auth_attempts WHERE email=?",email);
  byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);String token=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);Instant expires=Instant.now().plusSeconds(28800);
  jdbc.update("DELETE FROM auth_sessions WHERE expires_at<now()");
  jdbc.update("INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",SecurityConfig.hash(token),u.get("id"),java.sql.Timestamp.from(expires));
  return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of("access_token",token,"token_type","Bearer","expires_at",expires.toString(),"user",Map.of("id",u.get("id"),"role",u.get("role"))));
 }
 @GetMapping("/auth/me") public ResponseEntity<?> me(Authentication a){var u=jdbc.queryForMap("SELECT id,role,membership_status FROM users WHERE id=?::uuid",a.getName());return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(u);}
 @PostMapping("/auth/logout") public Map<String,Boolean> logout(@RequestHeader("Authorization") String h){jdbc.update("DELETE FROM auth_sessions WHERE token_hash=?",SecurityConfig.hash(h.substring(7)));return Map.of("revoked",true);}
 @PostMapping("/auth/logout-all") public Map<String,Boolean> logoutAll(Authentication a){jdbc.update("DELETE FROM auth_sessions WHERE user_id=?::uuid",a.getName());return Map.of("revoked",true);}
}
