# Trivia Theater

## Table of Contents

1. [Description](#description)
    - [Built With](#built-with)
    - [Live Demo](#live-demo)
2. [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
3. [Usage](#usage)

## Description

Trivia Theater is a web application where users can compete with each other in quiz games as well as manage quizzes.

This app was originally developed as part of the second integrative project [LOG2990](https://www.polymtl.ca/programmes/cours/projet-de-logiciel-dapplication-web) at Polytechnique Montréal.

During the third integrative project [LOG3900](https://www.polymtl.ca/programmes/cours/projet-devolution-dun-logiciel), it was further enhanced with additional features and a desktop app using [Electron](https://www.electronjs.org/) was made.

### Built With

Here are the core technologies used for this project:

-   [![Angular](https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white)](https://angular.dev/)
-   [![Node.js](https://img.shields.io/badge/Node%20js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
-   [![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?&style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
-   [![Express.js](https://img.shields.io/badge/Express%20js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
-   [![Socket.io](https://img.shields.io/badge/Socket.io-010101?&style=for-the-badge&logo=Socket.io&logoColor=white)](https://socket.io/)
-   [![MongoDB Atlas](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/products/platform/atlas-database)

Specifically, the project leverages MongoDB Atlas and Redis Cloud for database and caching solutions, respectively.

### Live Demo

You can view the deployed version of the project here: [Trivia Theater](https://trivia-theater.netlify.app)

-   Frontend hosted on

    [![Netlify](https://img.shields.io/badge/Netlify-00C7B7?style=for-the-badge&logo=netlify&logoColor=white)](https://www.netlify.com/)

-   Backend hosted on

    [![Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://render.com/)

## Getting Started

To get started with the project locally, follow the instructions below.

### Prerequisites

1. Install [Node.js](https://nodejs.org/en/)
2. Install [npm](https://www.npmjs.com/) for package management
3. Set up a MongoDB cluster on [MongoDB Atlas](https://www.mongodb.com/products/platform/atlas-database)
4. Set up a Redis instance on [Redis Cloud](https://redis.io/cloud/) for caching
5. Have an email account ready for configuring the email transporter

### Installation

To install and set up the project locally, follow these steps:

#### 1. Clone the repository

```bash
git clone https://github.com/steven-ho1/log3900-quiz-app
cd log3900-quiz-app
```

#### 2. Set up the web client

-   Navigate to the client-web folder and install dependencies:

```bash
cd client-web
npm ci
```

#### 3. Set up the server

-   Navigate to the server folder and install dependencies:

```bash
cd server
npm ci
```

-   Create a .env file with the following environment variables (consult the .env.example file for a template):

```env
# Secret key used for JWT or token-based authentication
TOKEN_SECRET=<your_token_secret_here>

# Redis configuration
REDIS_PASSWORD=<your_redis_password_here>
REDIS_HOST=<your_redis_host_here>
REDIS_PORT=<your_redis_port_here>

# Email configuration for sending emails
TRANSPORTER_EMAIL=<your_email_here>              # Email address used by the email transporter
TRANSPORTER_PASSWORD=<your_email_password_here>  # Password for the email address (or app-specific password)

# MongoDB connection URL
MONGODB_URL=<your_mongodb_connection_url_here>
```

## Usage

-   To start the web client:

```bash
cd client-web
npm start
```

-   To start the server:

```bash
cd server
npm run dev
```

Once both the client and server are running locally, you can navigate to the web client in your browser (typically http://localhost:4200 for an Angular app).
