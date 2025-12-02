# MedijobsRD - Job Board Platform

MedijobsRD is a job board platform connecting professionals with institutions. It features user authentication, job posting, application tracking, profile management, and real-time notifications.

## Features

- **User Roles:** Professionals and Institutions.
- **Job Management:** Post, edit, and delete job vacancies.
- **Applications:** Professionals can apply to jobs with CV uploads. Institutions can manage applications via a pipeline view.
- **Profiles:** Customizable profiles for professionals (experience, education, skills) and institutions.
- **Search & Filters:** Search vacancies by keywords, location, and contract type.
- **Real-time Notifications:** WebSockets integration for instant updates on applications and messages.
- **Messaging:** Built-in messaging system between professionals and institutions.
- **Email Notifications:** automated emails for verification, password resets, and job alerts (using SendGrid).
- **File Uploads:** Cloudinary integration for handling CVs and images.

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database
- Cloudinary account
- SendGrid account (for emails)

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd medijobsrd
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and add the following:

   ```env
   # Server Configuration
   PORT=3000
   FRONTEND_URL=http://localhost:3000 # or your production URL

   # Database
   DATABASE_URL=postgresql://user:password@localhost:5432/medijobsrd

   # Security
   JWT_SECRET=your_jwt_secret_key

   # Cloudinary (File Uploads)
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret

   # SendGrid (Email)
   SENDGRID_API_KEY=your_sendgrid_api_key
   ```

## Running the Application

To start the server:

```bash
npm start
```

The server will start on port 3000 (or the port specified in `.env`).

## API Endpoints

The API provides endpoints for:
- Authentication (`/register`, `/login`, `/verify-email`, `/forgot-password`, `/reset-password`)
- User Profiles (`/perfil`)
- Vacancies (`/vacantes`, `/institucion/vacantes`)
- Applications (`/postular/:id`, `/postulaciones`, `/institucion/postulaciones`)
- Notifications (`/notificaciones`)
- Messages (`/conversaciones`, `/mensajes`)
- Alerts (`/alertas`)

## Project Structure

- `server.js`: Main entry point (Express app, PostgreSQL connection, API routes).
- `public/`: Frontend files (HTML, CSS, JS).
- `index.js`: Legacy server file (SQLite version) - *Deprecated*.

## License

ISC
