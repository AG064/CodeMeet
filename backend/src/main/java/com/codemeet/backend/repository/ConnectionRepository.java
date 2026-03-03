package com.codemeet.backend.repository;

import com.codemeet.backend.model.Connection;
import com.codemeet.backend.model.ConnectionStatus;
import com.codemeet.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ConnectionRepository extends JpaRepository<Connection, UUID> {

    Optional<Connection> findByRequesterAndRecipient(User requester, User recipient);

    @Query("SELECT c FROM Connection c WHERE (c.requester = :user OR c.recipient = :user) AND c.status = :status")
    List<Connection> findByUserAndStatus(@Param("user") User user, @Param("status") ConnectionStatus status);

    @Query("SELECT c FROM Connection c WHERE c.recipient = :user AND c.status = 'PENDING'")
    List<Connection> findPendingRequestsForUser(@Param("user") User user);
    
    // Also handy to find by both combinations to see if an active connection exists
    @Query("SELECT c FROM Connection c WHERE ((c.requester = :user1 AND c.recipient = :user2) OR (c.requester = :user2 AND c.recipient = :user1)) AND c.status = :status")
    Optional<Connection> findConnectionBetweenUsers(@Param("user1") User user1, @Param("user2") User user2, @Param("status") ConnectionStatus status);

     // Check if ANY state of connection exists between two users (useful for avoiding duplicate requests/recomendations)
     @Query("SELECT c FROM Connection c WHERE (c.requester = :user1 AND c.recipient = :user2) OR (c.requester = :user2 AND c.recipient = :user1)")
     Optional<Connection> findAllConnectionsBetweenUsers(@Param("user1") User user1, @Param("user2") User user2);

}
