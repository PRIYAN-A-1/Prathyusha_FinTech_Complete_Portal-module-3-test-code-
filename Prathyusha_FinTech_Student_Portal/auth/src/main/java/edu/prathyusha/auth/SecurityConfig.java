package edu.prathyusha.auth;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.cors.*;
@Configuration
public class SecurityConfig {
 static String hash(String token){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
 @Bean BCryptPasswordEncoder passwords(){return new BCryptPasswordEncoder(12);}
 @Bean SecurityFilterChain chain(HttpSecurity http,JdbcTemplate jdbc) throws Exception {
  var filter=new OncePerRequestFilter(){protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain)throws ServletException,IOException{
   String h=req.getHeader("Authorization");
   if(h!=null&&h.startsWith("Bearer ")&&h.length()<200){var users=jdbc.queryForList("SELECT u.id,u.role FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>now() AND u.membership_status='APPROVED'",hash(h.substring(7)));if(!users.isEmpty()){var u=users.get(0);var a=new UsernamePasswordAuthenticationToken(u.get("id").toString(),null,List.of(new SimpleGrantedAuthority("ROLE_"+u.get("role"))));SecurityContextHolder.getContext().setAuthentication(a);}}
   chain.doFilter(req,res);
  }};
  return http.csrf(c->c.disable()).cors(c->c.configurationSource(cors())).sessionManagement(s->s.sessionCreationPolicy(SessionCreationPolicy.STATELESS)).authorizeHttpRequests(a->a.requestMatchers("/auth/login","/health").permitAll().anyRequest().authenticated()).exceptionHandling(e->e.authenticationEntryPoint((req,res,ex)->{res.setStatus(401);res.setContentType("application/json");res.getWriter().write("{\"error\":\"Invalid or expired session\"}");})).addFilterBefore(filter,UsernamePasswordAuthenticationFilter.class).build();
 }
 @Bean CorsConfigurationSource cors(){var c=new CorsConfiguration();c.setAllowedOrigins(List.of(System.getenv().getOrDefault("FRONTEND_ORIGIN","http://localhost:5173")));c.setAllowedMethods(List.of("GET","POST","OPTIONS"));c.setAllowedHeaders(List.of("Content-Type","Authorization"));var source=new UrlBasedCorsConfigurationSource();source.registerCorsConfiguration("/**",c);return source;}
}
