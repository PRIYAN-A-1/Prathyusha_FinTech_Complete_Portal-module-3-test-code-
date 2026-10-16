FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /src
COPY pom.xml ./
COPY src ./src
RUN mvn -q package -DskipTests
RUN mkdir -p /src/runtime && cd /src/runtime && jar xf ../target/fintech-auth-1.0.0.jar
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /src/runtime ./
USER 10001
EXPOSE 8080
ENTRYPOINT ["java","-cp","BOOT-INF/classes:BOOT-INF/lib/*","edu.prathyusha.auth.AuthApplication"]
