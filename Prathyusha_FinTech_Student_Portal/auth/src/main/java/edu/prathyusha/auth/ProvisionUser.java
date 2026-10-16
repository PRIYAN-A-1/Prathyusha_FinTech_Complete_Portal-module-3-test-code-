package edu.prathyusha.auth;
import java.sql.*;
import java.util.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
/** Offline administrator CLI; never exposed as an HTTP signup or approval API. */
public class ProvisionUser {
 public static void main(String[] args)throws Exception{
  String email=required("USER_EMAIL").trim().toLowerCase(Locale.ROOT),password=required("USER_PASSWORD"),name=required("USER_NAME"),reg=required("REGISTER_NUMBER");
  if(password.length()<12||password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length>72)throw new IllegalArgumentException("Password requires 12-72 bytes");
  String role=System.getenv().getOrDefault("USER_ROLE","STUDENT");if(!Set.of("STUDENT","ADMIN","SUPER_ADMIN","MENTOR").contains(role))throw new IllegalArgumentException("Invalid role");
  try(var c=DriverManager.getConnection(required("JDBC_URL"),required("DB_USER"),required("DB_PASSWORD"))){c.setAutoCommit(false);try{UUID id=UUID.randomUUID();try(var s=c.prepareStatement("INSERT INTO users(id,email,password_hash,full_name,register_number,role,membership_status) VALUES(?,?,?,?,?,?,'APPROVED')")){s.setObject(1,id);s.setString(2,email);s.setString(3,new BCryptPasswordEncoder(12).encode(password));s.setString(4,name);s.setString(5,reg);s.setString(6,role);s.executeUpdate();}try(var s=c.prepareStatement("INSERT INTO profiles(user_id,display_name) VALUES(?,?)")){s.setObject(1,id);s.setString(2,name);s.executeUpdate();}c.commit();System.out.println("Created approved "+role+" account "+id);}catch(Exception e){c.rollback();throw e;}}
 }
 static String required(String k){String v=System.getenv(k);if(v==null||v.isBlank())throw new IllegalArgumentException("Set "+k);return v;}
}
