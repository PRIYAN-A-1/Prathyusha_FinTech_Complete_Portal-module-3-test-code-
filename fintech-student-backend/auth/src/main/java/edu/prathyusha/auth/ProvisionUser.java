package edu.prathyusha.auth;
import java.util.*;
import org.springframework.boot.*;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.support.TransactionTemplate;
@Configuration
@Profile("provision")
class ProvisionUser {
 @Bean ApplicationRunner provision(JdbcTemplate db,PasswordEncoder encoder,TransactionTemplate tx){return args->{String email=System.getenv("PROVISION_EMAIL"),password=System.getenv("PROVISION_PASSWORD"),register=System.getenv("PROVISION_REGISTER"),name=System.getenv("PROVISION_NAME"),role=System.getenv().getOrDefault("PROVISION_ROLE","STUDENT");if(email==null||!email.contains("@")||register==null||name==null||password==null||password.length()<12||password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length>72||!Set.of("STUDENT","MENTOR","ADMIN").contains(role))throw new IllegalArgumentException("Set valid PROVISION_EMAIL/PASSWORD/REGISTER/NAME/ROLE");UUID id=UUID.randomUUID();tx.executeWithoutResult(t->{db.update("INSERT INTO users(id,email,password_hash,role,membership_status,register_number) VALUES(?,?,?,?,'APPROVED',?)",id,email.trim().toLowerCase(Locale.ROOT),encoder.encode(password),role,register);db.update("INSERT INTO profiles(user_id,display_name) VALUES(?,?)",id,name);db.update("INSERT INTO audit_logs(actor_id,action,target_id) VALUES(?,'OPERATOR_PROVISIONED',?)",id,id.toString());});System.out.println("Provisioned user "+id);System.exit(0);};}
}
