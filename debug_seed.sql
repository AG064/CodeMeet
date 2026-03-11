BEGIN;

INSERT INTO users (id, email, last_seen_at, name, password, profile_picture, role) VALUES
('11111111-1111-4111-8111-111111111111', 'alex.debug@example.com', '2026-03-07 09:00:00+0000', 'Alex Debug', '$2a$10$vI8aWBnW3fID.021/sOWcow1Jv/C3Q/WvS22XW.Xw/8G6P4Xm.O2y', NULL, 'USER'),
('22222222-2222-4222-8222-222222222222', 'sam.debug@example.com', '2026-03-07 08:30:00+0000', 'Sam Debug', '$2a$10$vI8aWBnW3fID.021/sOWcow1Jv/C3Q/WvS22XW.Xw/8G6P4Xm.O2y', NULL, 'USER'),
('33333333-3333-4333-8333-333333333333', 'riley.debug@example.com', '2026-03-06 21:15:00+0000', 'Riley Debug', '$2a$10$vI8aWBnW3fID.021/sOWcow1Jv/C3Q/WvS22XW.Xw/8G6P4Xm.O2y', NULL, 'USER');

INSERT INTO profiles (id, about_me, user_id) VALUES
('aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Hi! I''m Alex, a backend-focused developer who likes pair programming and geospatial side projects.', '11111111-1111-4111-8111-111111111111'),
('aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'Hi! I''m Sam, a frontend engineer who enjoys clean UI systems and mentoring.', '22222222-2222-4222-8222-222222222222'),
('aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'Hi! I''m Riley, a polyglot developer looking for practical collaboration partners.', '33333333-3333-4333-8333-333333333333');

INSERT INTO bios (id, coding_style, experience_level, look_for, preferred_os, primary_language, city, latitude, longitude, max_distance_km, age, user_id) VALUES
('bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'Night Owl', 'Senior', 'Mentor', 'Linux', 'Java', 'Tallinn', 59.437000, 24.753600, 25, 31, '11111111-1111-4111-8111-111111111111'),
('bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'Early Bird', 'Mid', 'Coding Buddy', 'macOS', 'TypeScript', 'Tallinn', 59.431200, 24.745300, 20, 28, '22222222-2222-4222-8222-222222222222'),
('bbbbbbb3-bbbb-4bbb-8bbb-bbbbbbbbbbb3', 'Night Owl', 'Mid', 'Networking', 'Windows', 'Python', 'Tallinn', 59.420500, 24.799400, 30, 29, '33333333-3333-4333-8333-333333333333');

COMMIT;
