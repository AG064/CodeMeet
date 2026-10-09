package com.codemeet.backend.service;

import com.codemeet.backend.IsolatedBackendTest;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTests {
    @Test
    void rejectsMissingWeakAndRetiredExampleKeys() {
        for (String secret : new String[]{"", " ", "short", "your-secret-" + "x".repeat(40),
                "8a3c8e4b17a12b45e9d98f731a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b"}) {
            assertThrows(IllegalArgumentException.class, () -> new JwtService(secret, 86400000));
        }
    }

    @Test
    void validatesOwnTokensAndRejectsOtherSigningKeys() {
        JwtService issuer = new JwtService(IsolatedBackendTest.randomSecret(), 86400000);
        JwtService other = new JwtService(IsolatedBackendTest.randomSecret(), 86400000);
        String token = issuer.generateToken("reader@example.test", "user-id", "USER");
        assertTrue(issuer.isTokenValid(token));
        assertEquals("reader@example.test", issuer.extractEmail(token));
        assertEquals("user-id", issuer.extractUserId(token));
        assertFalse(other.isTokenValid(token));
        assertFalse(issuer.isTokenValid("invalid-token"));
    }
}
