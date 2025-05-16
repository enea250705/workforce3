# Workforce Manager

A comprehensive staff management system that includes scheduling, time-off requests, document management, and more.

## Features

- User authentication with role-based access (admin/employee)
- Visual schedule planning and publishing
- Time-off request management
- Document storage and access
- Real-time notifications
- Responsive design for desktop and mobile

## VPS Deployment Instructions

This application can be deployed on a VPS (Virtual Private Server). Follow these instructions to set up and run the application.

### Prerequisites

- Node.js 16+ and npm
- PostgreSQL database
- Git

### Linux Deployment

1. Clone the repository:
   ```
   git clone https://your-repo-url/workforce-manager.git
   cd workforce-manager
   ```

2. Run the deployment script:
   ```
   ./deploy.sh
   ```

3. Edit the `.env` file with your database and other configurations:
   ```
   nano .env
   ```

4. Start the application:
   ```
   npm start
   ```

### Windows Deployment

1. Clone the repository:
   ```
   git clone https://your-repo-url/workforce-manager.git
   cd workforce-manager
   ```

2. Run the deployment script:
   ```
   deploy.bat
   ```

3. Edit the `.env` file with your database and other configurations using Notepad or another text editor.

4. Start the application:
   ```
   npm run start:win
   ```

### Database Setup

The application can use any PostgreSQL database. Configure the connection string in the `.env` file:

```
DATABASE_URL=postgres://username:password@hostname:5432/database_name
```

### Running in Production

For a production environment, it's recommended to use a process manager like PM2:

```
npm install -g pm2
pm2 start dist/index.js --name "workforce-manager"
```

### Default Login Credentials

- Admin: username=`admin`, password=`admin123`
- Employee: username=`employee`, password=`employee123`

After deployment, make sure to change these default passwords for security. 