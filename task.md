# CodeMeet Web & GraphQL

Create a full-stack recommendation application, to connect users based on their profile information.

## The Situation
Sometimes, it's hard to make new connections with people, and this is a problem that you currently face without even knowing it.

It could be a love interest, a professional connection, an acquaintance with which to enjoy live music, a dog-walking companion, or someone to play board games with.

Either way, whatever or whoever those missing connections are in your life, you're going to set about solving it now.

You'll make a recommendation platform, which matches people based on their interests, preferences and characteristics. It can match any profile of person, that's up to you.

## Functional Requirements
You will create a full-stack application, which matches user profiles based on your own recommendation algorithm.

It will allow users to register, view potential matches, connect with other users and chat.

### Registration & Login
- **Registration**: Enable users to sign up with a unique email address, and a password. The password must be securely protected using bcrypt with a salt.
- **Log in**: Users log in with their email address and password. Sessions are managed with a JWT.
- User must be able to log out from any page in the application.

### User Profile
- Users must complete their profile before they are able to see recommendations or connect with other users.
- Users will be matched based on their profiles, and the profile must be completed before any recommendations are made.
- The contents of the bio are up to you. (e.g. first/last name, username, "About me").
- You'll need to capture biographical information about the user. What are their interests, hobbies or any other relevant information?
- Users will also need to specify what they're looking for.
- Users should be able to add/remove/change their profile picture. If no picture is uploaded, some kind of placeholder image should be shown in its place "👤".
- Users must be able to modify their profile information at any time.
- **Your recommendation must be powered by no fewer than 5 biographical data points.**
- Profiles are not searchable, and should not be findable. Profiles are viewable by other users, only if:
  - They are recommended
  - There is an outstanding connection request
  - They are connected
- The email address is considered to be private, and must not be shown to anyone except to the authenticated user.

### Locations
- You'll need to implement some rudimentary location based sense-checking.
- If the best possible match is impractically far away, then they are not a suitable recommendation.
- This system could be a list of cities, where matches are only possible within that cities.

### Recommendations
- Users must be able to see a list of recommended connections. This list must be prioritized to show the strongest matches first.
- How the list is presented is up to you (list with connect/dismiss buttons, swipe right, etc).
- Once a potential user is dismissed, they should not be recommended again.
- You'll need to find some way to score recommendations. Some biographical data points could be more relevant than others.
- Weak recommendations must be avoided. You must be able to defend your implementation, and demonstrate that it works.
- The user can get a maximum of 10 recommendations at a time.

### Connections
- When a user sees a recommendation that they find interesting, they can request to connect with them.
- Users must be able to see a list of connection requests, where they can accept or dismiss requests.
- It must be possible to disconnect with a user, if they are no longer interesting.

### Chat
- Once two users are connected, they are able to chat with one another.
- From the connected user's profile, it must be possible to start or resume a chat. Only one chat history can exist between two users.
- The chat history must be visible to both users. You'll need to paginate this.
- Users must be able to see a list of all of their chats, with the most recent chats appearing first.
- There must be some icon to notify users that they have unread messages.
- The chat implementation must be **real-time**, and not rely on polling. If a new message is received:
  - The unread chat notification should appear
  - The chats should be reordered to show the most recent first
  - The message should immediately appear in the chat view
  - The date/time should be displayed for each chat message

### Endpoints
You must implement the following RESTful endpoints. None of them must return authentication-related data.

- `/users/{id}`: Returns the user's name and link to the profile picture.
- `/users/{id}/profile`: Returns the users "about me" type information.
- `/users/{id}/bio`: Returns the users biographical data.
- `/me`: A shortcut to `/users/{id}` for the authenticated user. Also implement `/me/profile` and `/me/bio`.
- `/recommendations`: Returns a max of 10 recommendations, containing only the id.
- `/connections`: Returns a list of connected profiles, containing only the id.
- All of the responses for `/users` data must also contain the id.
- If the id is not found, or the user does not have permission, return HTTP 404.

*Note: You would need to fetch combinations of these endpoints to compose a full view on the client side.*

### Technical Requirements
- Your back-end application must be implemented using primary language from Coding Fundamentals (e.g. Java).
- Your front-end application must be implemented in React using Typescript.
- Your data must be persisted in a PostgreSQL database.
- Your application must be secure (no leaking private information).
- Your application must be responsive (mobile and desktop).
- **Review Requirement**: Provide a way to load fictitious users (minimum 100) and run matching with scale. Must be able to drop DB and reload as a separate step.

### Extra Requirements (Optional)
- **Online Indicator**: Show an online/offline indicator on the user's profile and chat views.
- **Typing in progress**: Show a "typing" in progress indicator on the chat view 💬.
- **Proximity-based location**: Get user's location from browser API, store coordinates, and use a maximum radius to recommend within this radius.

---

## Part 2: CodeMeet GraphQL
Implement a GraphQL API to more efficiently serve data for your CodeMeet project.

### GraphQL API
- Expose your full server functionality via GraphQL to minimize queries and payload size.
- Both GraphQL and REST APIs must be available at the same time.
- Must support a toggle/flag for developer mode (e.g. `-d`) to expose the GraphQL playground.

### Required schema
Must implement types: `User` (containing Bio and Profile), `Bio` (containing User), `Profile` (containing User).

**Required queries:**
- `user(id) -> User`
- `bio(id) -> Bio`
- `profile(id) -> Profile`
- `me -> User`
- `myBio -> Bio`
- `myProfile -> Profile`
- `recommendations -> User`
- `connections -> User`
