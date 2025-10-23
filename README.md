# icare

**icare** is an automated service designed to streamline patient data processing between a Hospital Information System (SIMRS) and the Indonesian National Health Insurance (BPJS) web portal. It periodically fetches patient data, creates processing jobs, and uses browser automation to submit the data, all while providing a real-time web interface for monitoring.

> [!WARNING]
> This project, **icare**, is designed to automate specific patient verification tasks within the BPJS web portal. It is developed for **internal operational efficiency, research, and educational purposes**, addressing challenges with manual compliance. 

## ✨ Features

- **Automated Patient Processing**: Automatically fetches patient data from a SIMRS database on a configurable schedule.
- **Intelligent Scheduling**: Automatically skips job execution on Indonesian public holidays.
- **Browser Automation**: Uses Playwright to reliably automate interactions with the BPJS web portal.
- **Real-time Monitoring**: A web-based UI provides a live dashboard of job statuses (pending, done, failed).
- **Graceful Shutdown**: Ensures that running processes are completed before the application shuts down.
- **Containerized**: Fully containerized with Docker for easy deployment and scalability.
- **Telegram Notifications**: Sends notifications about job statuses via Telegram.

## 🚀 Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

- [Node.js](https://nodejs.org/) (v20.x or later)
- [pnpm](https://pnpm.io/) package manager
- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/rizkyilhampra/icare-automation
    cd icare-automation
    ```

2.  **Install dependencies:**
    ```bash
    pnpm install
    ```
    This will also install the necessary Playwright browser binaries.

### Configuration

The application is configured using environment variables. Create a `.env` file in the project root by copying the example file:

```bash
cp .env.example .env
```

Now, edit the `.env` file with your specific configuration:

```ini
# --- Application Configuration ---
# The port on which the application will listen.
PORT=3000

# The timezone for the application. This affects logging and cron job schedules.
# Example: Asia/Jakarta, Europe/London. Refer to IANA Time Zone Database for valid values.
TZ=Asia/Makassar

# Controls whether the browser runs in headless mode (true) or with a visible UI (false).
# Set to 'true' for production environments.
HEADLESS=true

# Maximum number of retries for processing a single job (e.g., patient BPJS verification).
# If a job fails this many times, it will be marked as 'failed' and no further attempts will be made.
MAX_ATTEMPT=3

# Whether application logs should be written to a file in addition to the console.
# Set to 'true' to enable file logging.
LOG_TO_FILE=true

# The current environment of the application (e.g., 'development', 'production', 'test').
# Affects logging levels, error handling, and other environment-specific behaviors.
NODE_ENV=production


# --- Cron Job Schedule ---
# Defines the schedule for cron jobs using standard cron syntax.
# For more information on cron syntax, see: https://crontab.guru/

# Schedule for weekdays (Monday-Friday): Every 10 minutes between 4 PM and 5:59 PM.
# Format: 'minute hour day_of_month month day_of_week'
# '*/10': Every 10 minutes
# '16-17': Between 4 PM and 5 PM (inclusive)
# '* *': Any day of the month, any month
# '1-5': Monday to Friday
WEEKDAY_CRON='*/10 16-17 * * 1-5'

# Schedule for Saturdays: Every 10 minutes between 12 PM and 1:59 PM.
# Format: 'minute hour day_of_month month day_of_week'
# '*/10': Every 10 minutes
# '12-13': Between 12 PM and 1 PM (inclusive)
# '* *': Any day of the month, any month
# '6': Saturday
SATURDAY_CRON='*/10 12-13 * * 6'


# --- Database Configuration (MySQL for SIMRS - Hospital Management Information System) ---
# Connection details for the MySQL database used by the SIMRS application.
SIMRS_DB_HOST=your_simrs_db_host
SIMRS_DB_USER=your_simrs_db_user
SIMRS_DB_PASSWORD=your_simrs_db_password
SIMRS_DB_DATABASE=your_simrs_db_name
SIMRS_DB_PORT=3306

# --- BPJS (Badan Penyelenggara Jaminan Sosial) API Configuration ---
# Credentials for accessing the BPJS Kesehatan API.
# Obtain these credentials from your BPJS partner account.
BPJS_CONS_ID=your_bpjs_consumer_id
BPJS_SECRET_KEY=your_bpjs_secret_key
BPJS_USER_KEY=your_bpjs_user_key


# --- Telegram Bot (Optional) ---
# Configuration for sending notifications via Telegram Bot.
# To set up a bot:
# 1. Talk to BotFather on Telegram to create a new bot and get your BOT_TOKEN.
# 2. Start a chat with your new bot and send a message.
# 3. Use an API call (e.g., https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates)
#    to find your chat_id (look for "id" in "chat" object).

TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
```

## Usage

### Running the Application

-   **Development Mode:**
    The following command starts the application in development mode with hot-reloading powered by `ts-node-dev`.

    ```bash
    pnpm dev
    ```

-   **Production Mode:**
    First, build the TypeScript code, then run the compiled JavaScript.
    ```bash
    pnpm build
    pnpm start
    ```

### Running with Docker

For a more production-like environment, you can use Docker Compose:

1.  Ensure your `.env` file is created and configured.
2.  Build and run the container in detached mode:
    ```bash
    docker-compose up -d --build
    ```
The service will be available at `http://localhost:3000` (or the `PORT` you specified).

## 🖥️ API Endpoints

The application exposes several endpoints:

-   `GET /`: Serves the main web-based monitoring UI.
-   `GET /health`: Health check endpoint used by Docker to monitor the application's status. Returns `200 OK` if the service is running.
-   `GET /jobs`: Returns a list of all jobs and their current status.
-   `GET /patients`: Returns a list of patients for the current day from the SIMRS database.
-   `GET /events`: A Server-Sent Events (SSE) endpoint that streams real-time job status summaries to the web UI.

## 📂 Project Structure

This project follows a standard structure to organize its various components. Below is a tree representation of the main directories and files:

```
.
├── data/
│   └── icare.sqlite3         # SQLite database file for job information
├── dist/                     # Compiled JavaScript output (from TypeScript)
├── docker-compose.yml        # Docker Compose configuration for multi-service deployment
├── Dockerfile                # Docker image build instructions
├── logs/
│   ├── combined.log          # Combined application logs
│   ├── error.log             # Error-specific logs
│   ├── exceptions.log        # Uncaught exceptions
│   └── rejections.log        # Unhandled promise rejections
├── public/
│   ├── index.html            # Main HTML for the monitoring UI
│   ├── script.js             # Frontend JavaScript for the UI
│   └── style.css             # Frontend CSS for the UI
├── src/                      # Main application source code
│   ├── index.ts              # Application entry point
│   ├── lib/                  # Core libraries (browser management, database, utilities)
│   ├── logger.ts             # Winston logger configuration
│   ├── routes/               # Express route handlers for API endpoints
│   ├── scheduler.ts          # Defines cron jobs for scheduled tasks
│   ├── services/             # Business logic (SIMRS, BPJS, Telegram interactions)
│   └── types/                # TypeScript type definitions
├── .env.example              # Example environment variable configuration
├── package.json              # Project dependencies and scripts
├── pnpm-lock.yaml            # pnpm lock file for deterministic installs
├── pnpm-workspace.yaml       # pnpm workspace configuration
├── README.md                 # This documentation file
└── tsconfig.json             # TypeScript compiler options
```

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
