# Smart Edu Agent

A comprehensive educational management and learning platform designed for modern academic institutions. This application integrates department-level resource management with an advanced interactive learning environment.

## Key Features

### 🎓 Learning & Academic Support
- **Interactive Knowledge Base**: Upload and index departmental resources, textbooks, and research papers.
- **Smart Tutor**: A context-aware learning assistant that provides detailed explanations, analogies, and structured breakdowns based on uploaded materials.
- **Visual Learning**: Automated generation of technical diagrams and flowcharts using Mermaid syntax to explain complex architectures.
- **Multi-format Support**: Handles text-based queries and visual synthesis for a complete learning experience.

### 📚 Library Management System
- **Catalog Management**: Track books, authors, and availability across different departments.
- **Issue & Return Tracking**: Automated management of book circulation.
- **Fine Management**: Real-time fine calculation for overdue books with fixed fine recording upon return.
- **Reservations**: Student reservation system for high-demand resources.

### 🏢 Institutional Hierarchy
- **Admin Portal**: Full control over users, departments, and global settings.
- **HOD Dashboard**: Department-specific monitoring of student activity and library usage.
- **Student/Faculty Portal**: Personalized dashboards for learning, notifications, and library services.

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Node.js, Express
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **AI Integration**: Google Gemini API
- **Diagrams**: Mermaid.js

1. Connect your GitHub repository to Netlify.
2. The `netlify.toml` file will handle the build settings and SPA routing.
3. Add your `GEMINI_API_KEY` and Firebase variables to the Netlify Environment Variables settings.

## License
This project is licensed under the MIT License.
