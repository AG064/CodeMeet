package com.codemeet.backend.graphql;

import com.codemeet.backend.IsolatedBackendTest;
import com.codemeet.backend.model.Bio;
import com.codemeet.backend.model.Connection;
import com.codemeet.backend.model.ConnectionStatus;
import com.codemeet.backend.model.Profile;
import com.codemeet.backend.model.User;
import com.codemeet.backend.repository.*;
import com.codemeet.backend.service.JwtService;
import com.codemeet.backend.service.RecommendationService;
import com.codemeet.backend.config.WebSocketAuthChannelInterceptor;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.http.MediaType;
import java.util.List;
import java.util.UUID;
import java.util.Date;
import java.nio.charset.StandardCharsets;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

class GraphqlPrivacyTests extends IsolatedBackendTest {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired BioRepository bios;
    @Autowired ProfileRepository profiles;
    @Autowired ConnectionRepository connections;
    @Autowired JwtService jwt;
    @Autowired WebSocketAuthChannelInterceptor websocketAuth;
    @MockitoBean RecommendationService recommendations;
    private User viewer;
    private User target;
    private Bio bio;
    private Profile profile;

    @BeforeEach
    void fixtures() {
        viewer = createUser();
        target = createUser();
        target.setHideAge(true);
        target.setHideLocation(true);
        target.setHideAvatar(true);
        target.setProfilePicture("/uploads/private-avatar.png");
        target = users.save(target);
        bio = new Bio();
        bio.setUser(target);
        bio.setCity("Test city");
        bio.setAge(31);
        bio.setLatitude(59.4);
        bio.setLongitude(24.7);
        bio.setMaxDistanceKm(20);
        bio = bios.save(bio);
        profile = new Profile();
        profile.setUser(target);
        profile.setAboutMe("Test profile");
        profile = profiles.save(profile);
        when(recommendations.getRecommendationsForUser(any(), anyInt())).thenReturn(List.of());
    }

    private User createUser() {
        User user = new User();
        user.setEmail(UUID.randomUUID() + "@example.test");
        user.setName(UUID.randomUUID().toString());
        user.setPassword("unused-in-token-tests");
        return users.save(user);
    }

    private void connect() {
        Connection connection = new Connection();
        connection.setRequester(viewer);
        connection.setRecipient(target);
        connection.setStatus(ConnectionStatus.ACCEPTED);
        connections.save(connection);
    }

    private ResultActions query(User actor, String query) throws Exception {
        return mvc.perform(post("/graphql")
                .header("Authorization", "Bearer " + jwt.generateToken(actor.getEmail(), actor.getId().toString(), actor.getRole().name()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"query\":\"" + query.replace("\"", "\\\"") + "\"}"));
    }

    private String userQuery() {
        return "{ user(id: \"" + target.getId() + "\") { id profilePicture bio { id city age latitude longitude maxDistanceKm } profile { id aboutMe } } }";
    }

    @Test
    void anonymousRequestsCannotQueryGraphql() throws Exception {
        mvc.perform(post("/graphql").contentType(MediaType.APPLICATION_JSON).content("{\"query\":\"{ me { id } }\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void retiredSigningKeyCannotAuthenticateHttpOrWebsocket() throws Exception {
        String oldKey = "8a3c8e4b17a12b45e9d98f731a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b";
        String forged = Jwts.builder().subject(viewer.getEmail())
                .claim("userId", viewer.getId().toString()).claim("role", "ADMIN")
                .expiration(new Date(System.currentTimeMillis() + 60000))
                .signWith(Keys.hmacShaKeyFor(oldKey.getBytes(StandardCharsets.UTF_8))).compact();
        mvc.perform(post("/graphql").header("Authorization", "Bearer " + forged)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"query\":\"{ me { id } }\"}"))
                .andExpect(status().isForbidden());
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setNativeHeader("Authorization", "Bearer " + forged);
        accessor.setLeaveMutable(true);
        org.junit.jupiter.api.Assertions.assertThrows(org.springframework.security.authentication.BadCredentialsException.class,
                () -> websocketAuth.preSend(MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders()), null));
    }

    @Test
    void configuredKeyAuthenticatesTheWebsocketIdentity() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setNativeHeader("Authorization", "Bearer " + jwt.generateToken(viewer.getEmail(), viewer.getId().toString(), "USER"));
        accessor.setLeaveMutable(true);
        websocketAuth.preSend(MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders()), null);
        assertEquals(viewer.getId().toString(), accessor.getUser().getName());
    }

    @Test
    void unrelatedUsersCannotReadDirectOrNestedRecords() throws Exception {
        query(viewer, userQuery()).andExpect(status().isOk()).andExpect(jsonPath("$.data.user").doesNotExist());
        query(viewer, "{ bio(id: \"" + bio.getId() + "\") { id city user { id } } profile(id: \"" + profile.getId() + "\") { id aboutMe } }")
                .andExpect(jsonPath("$.data.bio").doesNotExist()).andExpect(jsonPath("$.data.profile").doesNotExist());
    }

    @Test
    void connectedUsersReceiveRedactedFieldsWithoutChangingEntities() throws Exception {
        connect();
        query(viewer, userQuery()).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.user.id").value(target.getId().toString()))
                .andExpect(jsonPath("$.data.user.profilePicture").doesNotExist())
                .andExpect(jsonPath("$.data.user.bio.id").value(bio.getId().toString()))
                .andExpect(jsonPath("$.data.user.bio.age").doesNotExist())
                .andExpect(jsonPath("$.data.user.bio.city").doesNotExist())
                .andExpect(jsonPath("$.data.user.bio.latitude").doesNotExist())
                .andExpect(jsonPath("$.data.user.bio.longitude").doesNotExist())
                .andExpect(jsonPath("$.data.user.bio.maxDistanceKm").doesNotExist());
        assertEquals(31, bios.findById(bio.getId()).orElseThrow().getAge());
        assertEquals(59.4, bios.findById(bio.getId()).orElseThrow().getLatitude());
    }

    @Test
    void publicLocationStillNeverIncludesExactCoordinates() throws Exception {
        connect();
        target.setHideLocation(false);
        target.setHideAge(false);
        users.save(target);
        query(viewer, userQuery()).andExpect(jsonPath("$.data.user.bio.city").value("Test city"))
                .andExpect(jsonPath("$.data.user.bio.age").value(31))
                .andExpect(jsonPath("$.data.user.bio.latitude").doesNotExist())
                .andExpect(jsonPath("$.data.user.bio.longitude").doesNotExist());
    }

    @Test
    void blockingOverridesAnExistingConnection() throws Exception {
        connect();
        when(recommendations.isBlockedEitherDirection(any(), any())).thenReturn(true);
        query(viewer, userQuery()).andExpect(jsonPath("$.data.user").doesNotExist());
    }

    @Test
    void recommendationsAreVisibleAndSelfAndAdminRetainPrivateFields() throws Exception {
        when(recommendations.getRecommendationsForUser(any(), anyInt())).thenReturn(List.of(target.getId()));
        query(viewer, userQuery()).andExpect(jsonPath("$.data.user.id").value(target.getId().toString()));
        query(target, userQuery()).andExpect(jsonPath("$.data.user.bio.latitude").value(59.4))
                .andExpect(jsonPath("$.data.user.bio.age").value(31));
        viewer.setRole(User.Role.ADMIN);
        users.save(viewer);
        query(viewer, userQuery()).andExpect(jsonPath("$.data.user.bio.longitude").value(24.7))
                .andExpect(jsonPath("$.data.user.profilePicture").value("/uploads/private-avatar.png"));
    }
}
