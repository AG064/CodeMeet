package com.codemeet.backend.controller;

import com.codemeet.backend.dto.MessageDto;
import com.codemeet.backend.dto.PresenceStatusDto;
import com.codemeet.backend.dto.TypingEventDto;
import com.codemeet.backend.model.Connection;
import com.codemeet.backend.model.ConnectionStatus;
import com.codemeet.backend.model.Message;
import com.codemeet.backend.model.User;
import com.codemeet.backend.repository.ConnectionRepository;
import com.codemeet.backend.repository.MessageRepository;
import com.codemeet.backend.repository.UserRepository;
import com.codemeet.backend.service.FileService;
import com.codemeet.backend.service.PresenceService;
import com.codemeet.backend.service.RecommendationService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.security.Principal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/chat")
public class ChatController {
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final ConnectionRepository connectionRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final PresenceService presenceService;
    private final FileService fileService;
    private final RecommendationService recommendationService;

    public ChatController(
            MessageRepository messageRepository,
            UserRepository userRepository,
            ConnectionRepository connectionRepository,
            SimpMessagingTemplate messagingTemplate,
            PresenceService presenceService,
            FileService fileService,
            RecommendationService recommendationService
    ) {
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.connectionRepository = connectionRepository;
        this.messagingTemplate = messagingTemplate;
        this.presenceService = presenceService;
        this.fileService = fileService;
        this.recommendationService = recommendationService;
    }

    @MessageMapping("/chat")
    public void processMessage(@Payload MessageDto chatMessage, Principal principal) {

        if (principal == null || principal.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized websocket session");
        }

        User sender = resolvePrincipalUser(principal.getName());

        User recipient = userRepository.findById(chatMessage.getRecipientId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recipient not found"));

        ensureUsersCanInteract(sender, recipient);

        connectionRepository.findConnectionBetweenUsers(sender, recipient, ConnectionStatus.ACCEPTED)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Not connected with this user"));

        // Websocket sends still persist to the database first so chat history and unread counts stay consistent.
        Message message = new Message();
        message.setSender(sender);
        message.setRecipient(recipient);
        message.setContent(chatMessage.getContent());
        Message savedMessage = messageRepository.save(message);

        MessageDto mapped = mapToDto(savedMessage);

        messagingTemplate.convertAndSendToUser(
                recipient.getId().toString(), "/queue/messages", mapped
        );

        messagingTemplate.convertAndSendToUser(
            sender.getId().toString(), "/queue/messages", mapped
        );
    }

    @MessageMapping("/chat/typing")
    public void processTyping(@Payload TypingEventDto typingEvent, Principal principal) {
        if (principal == null || principal.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized websocket session");
        }

        User sender = resolvePrincipalUser(principal.getName());
        User recipient = userRepository.findById(typingEvent.getRecipientId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recipient not found"));

        ensureUsersCanInteract(sender, recipient);

        connectionRepository.findConnectionBetweenUsers(sender, recipient, ConnectionStatus.ACCEPTED)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Not connected with this user"));

        TypingEventDto outbound = new TypingEventDto();
        outbound.setSenderId(sender.getId());
        outbound.setRecipientId(recipient.getId());
        outbound.setTyping(typingEvent.isTyping());

        messagingTemplate.convertAndSendToUser(recipient.getId().toString(), "/queue/typing", outbound);
    }

    @GetMapping("/history/{partnerId}")
    public ResponseEntity<Page<MessageDto>> getChatHistory(
            @PathVariable UUID partnerId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication) {

        User currentUser = getCurrentUser(authentication);
        User partner = userRepository.findById(partnerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        ensureUsersCanInteract(currentUser, partner);

        connectionRepository.findConnectionBetweenUsers(currentUser, partner, ConnectionStatus.ACCEPTED)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Not connected with this user"));

        Pageable pageable = PageRequest.of(page, size);
        Page<Message> history = messageRepository.findChatHistory(currentUser, partner, pageable);

        // History is loaded over REST because it is paginated and requested on demand.
        Page<MessageDto> response = history.map(this::mapToDto);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/send/{recipientId}")
    public ResponseEntity<MessageDto> sendRestMessage(
            @PathVariable UUID recipientId,
            @RequestBody Map<String, String> body,
            Authentication authentication) {

        User sender = getCurrentUser(authentication);
        User recipient = userRepository.findById(recipientId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recipient not found"));

        ensureUsersCanInteract(sender, recipient);

        connectionRepository.findConnectionBetweenUsers(sender, recipient, ConnectionStatus.ACCEPTED)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Not connected with this user"));

        Message message = new Message();
        message.setSender(sender);
        message.setRecipient(recipient);
        message.setContent(body.get("content"));
        Message savedMessage = messageRepository.save(message);

        MessageDto dto = mapToDto(savedMessage);

        messagingTemplate.convertAndSendToUser(
                recipient.getId().toString(), "/queue/messages", dto
        );

        return ResponseEntity.ok(dto);
    }

    @PostMapping("/upload/{recipientId}")
    public ResponseEntity<MessageDto> uploadAttachment(
            @PathVariable UUID recipientId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "content", required = false, defaultValue = "") String content,
            Authentication authentication) {

        User sender = getCurrentUser(authentication);
        User recipient = userRepository.findById(recipientId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recipient not found"));

        ensureUsersCanInteract(sender, recipient);

        connectionRepository.findConnectionBetweenUsers(sender, recipient, ConnectionStatus.ACCEPTED)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Not connected with this user"));

        String fileUrl;
        try {
            fileUrl = fileService.saveFile(file);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to upload file");
        }

        String messageContent = content.isBlank() ? file.getOriginalFilename() : content;

        Message message = new Message();
        message.setSender(sender);
        message.setRecipient(recipient);
        message.setContent(messageContent);
        message.setAttachmentUrl(fileUrl);
        message.setAttachmentName(file.getOriginalFilename());
        Message savedMessage = messageRepository.save(message);

        MessageDto dto = mapToDto(savedMessage);

        messagingTemplate.convertAndSendToUser(
                recipient.getId().toString(), "/queue/messages", dto
        );
        messagingTemplate.convertAndSendToUser(
                sender.getId().toString(), "/queue/messages", dto
        );

        return ResponseEntity.ok(dto);
    }

    @GetMapping("/partners")
    public ResponseEntity<List<Map<String, Object>>> getChatPartners(Authentication authentication) {
        User currentUser = getCurrentUser(authentication);

        List<UUID> messagePartnerIds = messageRepository.findActiveChatPartners(currentUser.getId());

        List<Connection> acceptedConnections = connectionRepository.findByUserAndStatus(currentUser, ConnectionStatus.ACCEPTED);

        // Merge recent chat partners with accepted connections so the sidebar can show both active and newly accepted chats.
        java.util.LinkedHashSet<UUID> orderedIds = new java.util.LinkedHashSet<>(messagePartnerIds);
        for (Connection conn : acceptedConnections) {
            UUID peerId = conn.getRequester().getId().equals(currentUser.getId())
                    ? conn.getRecipient().getId()
                    : conn.getRequester().getId();
            orderedIds.add(peerId);
        }

        List<Map<String, Object>> response = orderedIds.stream().map(id -> {
            User p = userRepository.findById(id).orElse(null);
            if (p != null && !recommendationService.isBlockedEitherDirection(currentUser, p)) {
                long unreadCount = messageRepository.countUnreadMessages(p, currentUser);
                Map<String, Object> map = new java.util.HashMap<>();
                map.put("id", p.getId().toString());
                String displayName = (p.getName() != null && !p.getName().trim().isBlank())
                        ? p.getName().trim()
                        : ("User-" + p.getId().toString().substring(0, 8));
                map.put("name", displayName);
                map.put("unreadCount", unreadCount);
                return map;
            }
            return null;
        }).filter(java.util.Objects::nonNull).collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    @PostMapping("/read/{senderId}")
    public ResponseEntity<String> markAsRead(@PathVariable UUID senderId, Authentication authentication) {
        User currentUser = getCurrentUser(authentication);
        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        ensureUsersCanInteract(currentUser, sender);

        List<Message> unreads = messageRepository.findBySenderAndRecipientAndIsReadFalse(sender, currentUser);
        for (Message m : unreads) {
            m.setRead(true);
        }
        messageRepository.saveAll(unreads);
        return ResponseEntity.ok("Marked as read");
    }

    @GetMapping("/presence")
    public ResponseEntity<Map<String, PresenceStatusDto>> getPresenceForConnections(Authentication authentication) {
        User currentUser = getCurrentUser(authentication);
        List<Connection> acceptedConnections = connectionRepository.findByUserAndStatus(currentUser, ConnectionStatus.ACCEPTED);

        Map<String, PresenceStatusDto> response = new HashMap<>();
        for (Connection connection : acceptedConnections) {
            User peer = connection.getRequester().getId().equals(currentUser.getId())
                    ? connection.getRecipient()
                    : connection.getRequester();
            if (!recommendationService.isBlockedEitherDirection(currentUser, peer)) {
                boolean lastSeenVisible = !peer.isHideLastSeen();
                response.put(
                        peer.getId().toString(),
                        new PresenceStatusDto(presenceService.isOnline(peer.getId()), lastSeenVisible ? peer.getLastSeenAt() : null, lastSeenVisible)
                );
            }
        }

        return ResponseEntity.ok(response);
    }

    private MessageDto mapToDto(Message message) {
        return MessageDto.builder()
                .id(message.getId())
                .senderId(message.getSender().getId())
                .recipientId(message.getRecipient().getId())
                .content(message.getContent())
                .attachmentUrl(message.getAttachmentUrl())
                .attachmentName(message.getAttachmentName())
                .timestamp(message.getTimestamp())
                .isRead(message.isRead())
                .build();
    }

    private User getCurrentUser(Authentication authentication) {
        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private void ensureUsersCanInteract(User userA, User userB) {
        if (recommendationService.isBlockedEitherDirection(userA, userB)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot interact with this user");
        }
    }

    private User resolvePrincipalUser(String principalName) {
        // Websocket principals may be stored as a user id or an email, depending on which auth path created them.
        try {
            UUID userId = UUID.fromString(principalName);
            return userRepository.findById(userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sender not found"));
        } catch (IllegalArgumentException ignored) {
            return userRepository.findByEmail(principalName)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sender not found"));
        }
    }
}
