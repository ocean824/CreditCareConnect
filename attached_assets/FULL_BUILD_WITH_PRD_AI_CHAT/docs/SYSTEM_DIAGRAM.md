# ASCII System Diagram

         +--------------+        +----------------+         +-------------+
         |   Frontend   | <====> |    Backend     | <=====> |   Database  |
         | (React/Vite) |        | (Express/TS)   |         | (PostgreSQL)|
         +--------------+        +----------------+         +-------------+
                 |                       |                          |
         +---------------+      +------------------+        +--------------+
         | AI Assistant  |<====>| /api/ai/message  |        |  trusted_devices |
         |  (OpenAI UI)  |      +------------------+        |  user_sessions   |
         +---------------+                                    +--------------+

