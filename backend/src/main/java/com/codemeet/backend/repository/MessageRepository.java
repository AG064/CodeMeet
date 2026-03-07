package com.codemeet.backend.repository;

import com.codemeet.backend.model.Message;
import com.codemeet.backend.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<Message, UUID> {

    @Query("SELECT m FROM Message m WHERE (m.sender = :user1 AND m.recipient = :user2) OR (m.sender = :user2 AND m.recipient = :user1) ORDER BY m.timestamp DESC")
    Page<Message> findChatHistory(@Param("user1") User user1, @Param("user2") User user2, Pageable pageable);

    @Query("SELECT COUNT(m) FROM Message m WHERE m.sender = :sender AND m.recipient = :recipient AND m.isRead = false")
    long countUnreadMessages(@Param("sender") User sender, @Param("recipient") User recipient);

        @Query(value = "SELECT partner_id FROM (" +
            "SELECT recipient_id AS partner_id, timestamp FROM messages WHERE sender_id = :userId " +
            "UNION ALL " +
            "SELECT sender_id AS partner_id, timestamp FROM messages WHERE recipient_id = :userId " +
            ") sub GROUP BY partner_id ORDER BY MAX(timestamp) DESC", nativeQuery = true)
    List<UUID> findActiveChatPartners(@Param("userId") UUID userId);

    List<Message> findBySenderAndRecipientAndIsReadFalse(User sender, User recipient);

    void deleteByTimestampAfter(java.time.ZonedDateTime timestamp);
}
