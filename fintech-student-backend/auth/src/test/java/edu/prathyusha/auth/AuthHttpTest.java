package edu.prathyusha.auth;
import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import java.net.URI;
import java.net.http.*;
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={"spring.datasource.url=jdbc:postgresql://127.0.0.1:59999/unused","spring.datasource.username=unused","spring.datasource.password=unused"})
class AuthHttpTest {
 @LocalServerPort int port;
 HttpClient client=HttpClient.newHttpClient();
 @Test void missingInternalKeyReturns401NotErrorDispatch403() throws Exception {var req=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/internal/introspect")).GET().build();assertEquals(401,client.send(req,HttpResponse.BodyHandlers.ofString()).statusCode());}
 @Test void invalidLoginReturns401WithoutDatabase() throws Exception {var req=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/auth/login")).header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString("{\"email\":\"a@example.com\",\"password\":\"\"}")).build();assertEquals(401,client.send(req,HttpResponse.BodyHandlers.ofString()).statusCode());}
}
