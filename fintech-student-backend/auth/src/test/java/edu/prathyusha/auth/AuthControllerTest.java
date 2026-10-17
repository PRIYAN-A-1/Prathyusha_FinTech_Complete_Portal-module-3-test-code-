package edu.prathyusha.auth;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.support.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.mock.web.MockHttpServletRequest;
class AuthControllerTest {
 JdbcTemplate db;AuthController auth;UUID id=UUID.randomUUID();
 @BeforeEach @SuppressWarnings("unchecked") void setup(){db=mock(JdbcTemplate.class);var tx=mock(TransactionTemplate.class);when(tx.execute(any())).thenAnswer(i->((TransactionCallback<Object>)i.getArgument(0)).doInTransaction(null));auth=new AuthController(db,new BCryptPasswordEncoder(4),tx);}
 Map<String,Object> user(String status){var u=new HashMap<String,Object>();u.put("id",id);u.put("password_hash",new BCryptPasswordEncoder(4).encode("valid-password-123"));u.put("membership_status",status);u.put("role","STUDENT");return u;}
 @Test void bearerIsStrict(){assertThrows(ResponseStatusException.class,()->AuthController.bearer("Bearer admin"));assertThrows(ResponseStatusException.class,()->AuthController.bearer(null));}
 @Test void sessionTokenIsHashed(){String t="a".repeat(43);assertEquals(64,AuthController.hash(t).length());assertNotEquals(t,AuthController.hash(t));}
 @Test void internalKeyIsRequired(){assertThrows(ResponseStatusException.class,()->auth.introspect("wrong","Bearer "+"a".repeat(43)));verifyNoInteractions(db);}
 @Test void unknownUserCannotSignIn(){when(db.queryForList(eq("SELECT * FROM users WHERE email=? FOR UPDATE"),anyString())).thenReturn(List.of());assertThrows(ResponseStatusException.class,()->auth.login(Map.of("email","unknown@example.com","password","valid-password-123"),new MockHttpServletRequest()));}
 @Test void suspendedUserCannotReceiveSession(){when(db.queryForList(eq("SELECT * FROM users WHERE email=? FOR UPDATE"),anyString())).thenReturn(List.of(user("SUSPENDED")));assertThrows(ResponseStatusException.class,()->auth.login(Map.of("email","a@example.com","password","valid-password-123"),new MockHttpServletRequest()));verify(db,never()).update(startsWith("INSERT INTO sessions"),any(),any());}
 @Test void validMemberReceivesOpaqueSession(){when(db.queryForList(eq("SELECT * FROM users WHERE email=? FOR UPDATE"),anyString())).thenReturn(List.of(user("APPROVED")));var result=auth.login(Map.of("email","a@example.com","password","valid-password-123"),new MockHttpServletRequest());assertTrue(result.get("access_token").toString().matches("[A-Za-z0-9_-]{43}"));assertEquals(28800,result.get("expires_in"));verify(db).update(eq("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,now()+interval '8 hours')"),eq(AuthController.hash(result.get("access_token").toString())),eq(id));}
 @Test void wrongPasswordUpdatesFailureCount(){when(db.queryForList(eq("SELECT * FROM users WHERE email=? FOR UPDATE"),anyString())).thenReturn(List.of(user("APPROVED")));assertThrows(ResponseStatusException.class,()->auth.login(Map.of("email","a@example.com","password","wrong-password"),new MockHttpServletRequest()));verify(db).update(startsWith("UPDATE users SET failed_attempts=failed_attempts+1"),eq(id));}
}
