# Firebase Studio

# MineVerse

MineVerse is a web-based Minesweeper game with added features for user profiles, game history, statistics, friendships, and AI assistance for game review. It utilizes Next.js, React, Firebase for backend services (authentication, Firestore database), and Genkit with Google AI for AI features.

## Key Features:

- User Authentication: Login and registration using Firebase Auth.
- Minesweeper Gameplay: Play the classic Minesweeper game with different difficulty levels.
- Game History: View a history of played games.
- Game Review: Replay past games and see game state at each move.
- Statistics: Track overall game performance, win/loss ratio, and stats by difficulty.
- Friends: Manage friendships within the application.
- Profile Settings: Update display name, avatar, and privacy settings for stats and history.
- AI Assistance (in Game Review): Get insights and analysis of your game from an AI (requires backend setup with Genkit and a language model).
- Theme Toggle: Switch between light and dark modes.

## Technologies Used:

- Next.js
- React
- TypeScript
- Firebase (Authentication, Firestore)
- Genkit
- Google AI (for AI features)
- Tailwind CSS
- Zod
- Recharts

## Setup and Deployment:

- The project uses Firebase for hosting and potentially Cloud Functions.
- Environment variables, specifically for the Gemini API key, need to be configured in the Firebase project settings for deployed versions.