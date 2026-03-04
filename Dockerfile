# Build Frontend
FROM node:20-alpine AS frontend-build
WORKDIR /build/frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Build Backend ---
FROM maven:3.9-eclipse-temurin-21 AS backend-build
WORKDIR /build/backend
COPY backend/pom.xml .
RUN mvn dependency:go-offline
COPY backend/src ./src


COPY --from=frontend-build /build/frontend/dist ./src/main/resources/static
RUN mvn clean package -DskipTests

# pRuntime image
FROM eclipse-temurin:21-jre-alpine
RUN apk add --no-cache python3 py3-pip
WORKDIR /app
# Use a wildcard to find the jar regardless of version name
COPY --from=backend-build /build/backend/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]