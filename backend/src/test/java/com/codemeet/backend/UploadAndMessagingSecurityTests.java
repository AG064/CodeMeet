package com.codemeet.backend;
import com.codemeet.backend.service.FileService;
import com.codemeet.backend.config.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.messaging.support.*;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.file.*;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class UploadAndMessagingSecurityTests extends IsolatedBackendTest {
    @Autowired FileService files;
    @Autowired MockMvc mvc;
    @Autowired WebSocketAuthChannelInterceptor stomp;
    @Value("${file.upload-dir}") String directory;
    private byte[] png() throws Exception {
        var output = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB), "png", output);
        return output.toByteArray();
    }
    @Test void imagesReencodeAndGenericFilesDownloadWithOriginalBytes() throws Exception {
        byte[] pixels = png();
        String avatar = files.saveProfileImage(new MockMultipartFile("file", "spoof.html", "text/html", pixels));
        assertTrue(avatar.endsWith(".png"));
        assertNotNull(ImageIO.read(files.resolveDownload(avatar.substring(9)).toFile()));
        mvc.perform(get(avatar)).andExpect(status().isOk()).andExpect(content().contentType("image/png"))
            .andExpect(header().string("X-Content-Type-Options", "nosniff"));
        byte[] html = "<script>synthetic_active_content()</script>".getBytes();
        String attachment = files.saveFile(new MockMultipartFile("file", "picture.svg", "image/png", html));
        assertTrue(attachment.endsWith(".svg"));
        assertArrayEquals(html, Files.readAllBytes(files.resolveDownload(attachment.substring(9))));
        mvc.perform(get(attachment)).andExpect(status().isOk()).andExpect(content().contentType("application/octet-stream"))
            .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.startsWith("attachment")))
            .andExpect(header().string("Content-Security-Policy", "default-src 'none'; sandbox"));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
            () -> files.saveProfileImage(new MockMultipartFile("file", "image.png", "image/png", html)));
    }
    @Test void legacyActiveDocumentsCannotExecuteInline() throws Exception {
        Files.createDirectories(Path.of(directory));
        for (String extension : new String[]{".html", ".svg"}) {
            String name = UUID.randomUUID() + extension;
            Files.writeString(Path.of(directory).resolve(name), "<svg onload='synthetic()'/>");
            mvc.perform(get("/uploads/" + name)).andExpect(status().isOk())
                .andExpect(content().contentType("application/octet-stream"))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.startsWith("attachment")))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"));
            Files.delete(Path.of(directory).resolve(name));
        }
        mvc.perform(get("/uploads/unknown.html")).andExpect(status().isNotFound());
    }
    @Test void ordinaryPdfAndZipAttachmentsRetainTheirExtensionsAndBytes() throws Exception {
        for (String extension : new String[]{"pdf", "zip"}) {
            byte[] bytes = ("synthetic_" + extension).getBytes();
            String url = files.saveFile(new MockMultipartFile("file", "document." + extension, "application/octet-stream", bytes));
            assertTrue(url.endsWith("." + extension));
            mvc.perform(get(url)).andExpect(status().isOk()).andExpect(content().bytes(bytes))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.endsWith("." + extension + "\"")));
        }
    }
    private org.springframework.messaging.Message<byte[]> message(StompCommand command, String destination, boolean authenticated) {
        var accessor = StompHeaderAccessor.create(command);
        accessor.setDestination(destination);
        if (authenticated) accessor.setUser(new StompPrincipal(UUID.randomUUID().toString()));
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }
    @Test void connectAndDestinationGuardsFailClosed() {
        assertThrows(BadCredentialsException.class, () -> stomp.preSend(message(StompCommand.CONNECT, "", false), null));
        for (String destination : new String[]{"/queue/messages", "/topic/events", "/user/victim/queue/messages", "/app/chat/../chat", "/app/unknown"}) {
            assertThrows(AccessDeniedException.class, () -> stomp.preSend(message(StompCommand.SEND, destination, true), null));
        }
        for (String destination : new String[]{"/app/chat", "/app/chat/typing"}) {
            assertNotNull(stomp.preSend(message(StompCommand.SEND, destination, true), null));
            assertThrows(AccessDeniedException.class, () -> stomp.preSend(message(StompCommand.SEND, destination, false), null));
        }
        for (String destination : new String[]{"/user/queue/messages", "/user/queue/typing", "/user/queue/presence", "/user/queue/notifications"})
            assertNotNull(stomp.preSend(message(StompCommand.SUBSCRIBE, destination, true), null));
        for (String destination : new String[]{"/queue/messages", "/topic/events", "/user/victim/queue/messages"})
            assertThrows(AccessDeniedException.class, () -> stomp.preSend(message(StompCommand.SUBSCRIBE, destination, true), null));
        for (StompCommand command : new StompCommand[]{StompCommand.UNSUBSCRIBE, StompCommand.DISCONNECT})
            assertNotNull(stomp.preSend(message(command, "", true), null));
    }
}
