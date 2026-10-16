package edu.prathyusha.auth;
import java.util.Map;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
@RestControllerAdvice
public class ApiErrors {
 @ExceptionHandler(MethodArgumentNotValidException.class)
 public ResponseEntity<?> validation(){return ResponseEntity.unprocessableEntity().body(Map.of("error","Invalid login fields"));}
 @ExceptionHandler(Exception.class)
 public ResponseEntity<?> internal(Exception e){System.err.println("Auth service error: "+e.getClass().getSimpleName()+": "+e.getMessage());return ResponseEntity.status(503).body(Map.of("error","Authentication service unavailable"));}
}
