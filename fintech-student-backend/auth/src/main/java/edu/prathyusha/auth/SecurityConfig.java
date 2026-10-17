package edu.prathyusha.auth;
import java.util.List;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.*;
@Configuration
public class SecurityConfig {
 @Bean PasswordEncoder encoder(){return new BCryptPasswordEncoder(12);}
 @Bean SecurityFilterChain security(HttpSecurity http) throws Exception {
  // Stateless opaque bearer tokens are validated by the auth controller. No cookie authentication.
  return http.cors(c->c.configurationSource(cors())).csrf(c->c.disable()).sessionManagement(s->s.sessionCreationPolicy(SessionCreationPolicy.STATELESS)).authorizeHttpRequests(a->a.dispatcherTypeMatchers(jakarta.servlet.DispatcherType.ERROR).permitAll().requestMatchers("/auth/login","/auth/logout","/auth/password","/internal/introspect").permitAll().anyRequest().denyAll()).formLogin(f->f.disable()).httpBasic(b->b.disable()).build();
 }
 CorsConfigurationSource cors(){var c=new CorsConfiguration();c.setAllowedOrigins(List.of(System.getenv().getOrDefault("FRONTEND_ORIGIN","http://localhost:5173")));c.setAllowedMethods(List.of("POST","OPTIONS"));c.setAllowedHeaders(List.of("Authorization","Content-Type"));var s=new UrlBasedCorsConfigurationSource();s.registerCorsConfiguration("/auth/**",c);return s;}
}
