# GPay Cost Analyser

A comprehensive financial transaction analysis system that automatically monitors, extracts, classifies, and visualizes your Google Pay and HDFC Bank transactions. The system uses AI-powered classification to categorize transactions and provides an intuitive dashboard for expense tracking and analysis.

## 🚀 Features

### Real-time Transaction Monitoring
- **Email Monitoring**: Automatically monitors Gmail inbox for HDFC Bank debit alert emails using IMAP IDLE
- **Google Drive Polling**: Periodically checks Google Drive for new transaction HTML files from Google Takeout
- **Automatic Processing**: New transactions are automatically extracted and classified

### AI-Powered Classification
- Uses Google Gemini AI to intelligently classify transactions into categories:
  - Quick Commerce (Blinkit, Zepto)
  - Ecommerce (Amazon, Flipkart)
  - Subscriptions (Spotify, Netflix, Hotstar, Google Play)
  - Public Transport (BMTC, Metro)
  - Office Lunch (Hungerbox)
  - Grocery, Eating Out, Fuel, Personal Transfer, and more

### Interactive Dashboard
- **Visual Analytics**: Pie charts, bar charts, and line graphs for expense visualization
- **Date Range Filtering**: Filter transactions by custom date ranges
- **Classification Filtering**: View expenses by category
- **Transaction Management**: Add, edit, and reclassify transactions
- **Transaction Normalization**: Split shared expenses and track who paid

### Multi-User Support
- OAuth2 authentication with Google
- Support for multiple users with separate token management
- Secure credential storage

## 🏗️ Architecture

The system consists of several microservices orchestrated via Docker Compose:

```
┌─────────────────┐
│   Next.js UI    │ (Port 3000)
│  Dashboard      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   FastAPI API   │ (Port 8000)
│   gemini_test   │
└────────┬────────┘
         │
    ┌────┴────┬──────────────┬─────────────┐
    ▼         ▼              ▼             ▼
┌────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐
│ Email  │ │  Google  │ │ Gemini   │ │  JSON   │
│Monitor │ │  Drive  │ │   AI     │ │ Storage │
│Service │ │  Poller │ │          │ │         │
└────────┘ └──────────┘ └──────────┘ └─────────┘
```

### Services

1. **API Service** (`gemini_test.py`): FastAPI backend providing REST endpoints
2. **Email Monitor** (`email_monitor.py`): Real-time Gmail monitoring using IMAP IDLE
3. **Google Drive Poller** (`GoogleDrivePoll.py`): Polls Google Drive for transaction files
4. **Frontend** (`financial-dashboard/`): Next.js dashboard application
5. **Nginx**: Reverse proxy and SSL termination
6. **Certbot**: Automatic SSL certificate management

## 📋 Prerequisites

- **Python 3.9+**
- **Node.js 18+** and npm
- **Docker** and **Docker Compose** (for containerized deployment)
- **Google Cloud Project** with:
  - OAuth 2.0 credentials
  - Gmail API enabled
  - Google Drive API enabled
- **Google Gemini API Key** (or OpenAI API key)
- **Gmail Account** with IMAP enabled

## 🔧 Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Gpay-Cost-Analyser
```

### 2. Backend Setup

#### Install Python Dependencies

```bash
pip install -r requirements.txt
```

#### Configure Google OAuth

1. Create a Google Cloud Project at [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the following APIs:
   - Gmail API
   - Google Drive API
   - Google OAuth2 API
3. Create OAuth 2.0 credentials (Desktop application type)
4. Download the credentials JSON file and save it as `credentials.json` in the project root

#### Environment Variables

Create a `.env` file in the project root:

```env
# Google Gemini API Key (or OpenAI API key)
OPENAI_API_KEY=your_gemini_api_key_here

# Website URL (for OAuth redirect)
WEBSITE_URL=http://localhost:8000

# Optional: Frontend URL
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Frontend Setup

```bash
cd financial-dashboard
npm install
```

Create a `.env.local` file in `financial-dashboard/`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 4. Initial Authentication

1. Start the API server:
   ```bash
   uvicorn gemini_test:app --reload --port 8000
   ```

2. Visit `http://localhost:8000/login` in your browser
3. Complete the OAuth flow to authorize access to Gmail and Google Drive
4. Your tokens will be saved in the `tokens/` directory

## 🚀 Running the Application

### Development Mode

#### Backend
```bash
# Terminal 1: Start API
uvicorn gemini_test:app --reload --port 8000

# Terminal 2: Start Email Monitor
python email_monitor.py

# Terminal 3: Start Google Drive Poller (optional)
python GoogleDrivePoll.py
```

#### Frontend
```bash
cd financial-dashboard
npm run dev
```

Visit `http://localhost:3000` to access the dashboard.

### Production Mode (Docker Compose)

```bash
docker-compose up -d
```

This will start all services:
- API on port 8000
- Email Monitor (background)
- Google Drive Poller (background)
- Nginx on ports 80/443
- Certbot for SSL

## 📡 API Endpoints

### Authentication
- `GET /login` - Initiate Google OAuth login
- `GET /oauth2callback` - OAuth callback handler
- `GET /users` - List all authenticated users

### Transactions
- `POST /daterange` - Get transactions within a date range
  ```json
  {
    "startDate": "2024-01-01",
    "endDate": "2024-01-31"
  }
  ```

- `POST /add-transaction` - Manually add a transaction
  ```json
  {
    "Amount": "100.00",
    "Classification": "Eating Out",
    "Receiver": "Restaurant Name",
    "Date": "2024-01-15 12:30:00"
  }
  ```

- `POST /reclassify` - Reclassify an existing transaction
  ```json
  {
    "original": { /* Transaction object */ },
    "newClassification": "New Category"
  }
  ```

- `POST /normalize` - Normalize a transaction (split expenses)
  ```json
  {
    "original": { /* Transaction object */ },
    "paidToMe": "50.00",
    "payers": [
      { "name": "Friend 1", "amount": "25.00" },
      { "name": "Friend 2", "amount": "25.00" }
    ]
  }
  ```

- `POST /classify` - Classify transactions from HTML file (batch processing)

## 📁 Project Structure

```
Gpay-Cost-Analyser/
├── email_monitor.py          # Gmail IMAP IDLE monitoring service
├── gemini_test.py            # FastAPI application (main API)
├── getTransactions.py        # HTML parsing utilities
├── GoogleDrivePoll.py        # Google Drive polling service
├── requirements.txt          # Python dependencies
├── Dockerfile                # Docker image definition
├── docker-compose.yml        # Docker Compose configuration
├── credentials.json          # Google OAuth credentials (not in repo)
├── .env                      # Environment variables (not in repo)
├── new_transactions.json     # Transaction storage
├── tokens/                   # OAuth tokens (per user)
├── financial-dashboard/      # Next.js frontend
│   ├── src/
│   │   ├── app/             # Next.js app router
│   │   ├── components/      # React components
│   │   ├── lib/             # Utilities
│   │   └── types/           # TypeScript types
│   └── package.json
└── nginx/                    # Nginx configuration
    └── conf.d/
```

## 🔐 Security Notes

- **Never commit** `credentials.json`, `.env`, or `tokens/` directory to version control
- OAuth tokens are stored per-user in the `tokens/` directory
- The system uses OAuth2 refresh tokens for long-term access
- Email monitoring uses XOAUTH2 authentication with Gmail IMAP

## 🐛 Troubleshooting

### Email Monitor Not Working
- Ensure IMAP is enabled in your Gmail account
- Check that OAuth tokens are valid (re-authenticate via `/login` if needed)
- Verify the `OPENAI_API_KEY` is set correctly

### Transactions Not Appearing
- Check that `new_transactions.json` exists and is readable
- Verify the email monitor is running and processing emails
- Check API logs for classification errors

### OAuth Issues
- Ensure `credentials.json` is in the project root
- Verify `WEBSITE_URL` in `.env` matches your actual URL
- Check that redirect URI is configured in Google Cloud Console

## 🚢 Deployment

The project includes Docker Compose configuration for easy deployment. For production:

1. Update `WEBSITE_URL` in `.env` to your production domain
2. Configure Nginx in `nginx/conf.d/` for your domain
3. Set up SSL certificates (Certbot is included)
4. Run `docker-compose up -d`

See `.github/workflows/deploy.yml` for CI/CD configuration example.

## 📝 Transaction Classification Rules

The AI classifier follows these rules:
1. No receiver → Personal Contact
2. Blinkit/Zepto → Quick Commerce
3. Amazon/Flipkart → Ecommerce
4. Spotify/Netflix/Hotstar/Google Play → Subscriptions
5. BMTC/Metro → Public Transport
6. Hungerbox → Office Lunch
7. Contains "supermarket"/"store"/"mart" → Grocery
8. Restaurant/food chain/Zomato → Eating Out
9. Personal names → Personal Transfer
10. Contains "Fuel" → Fuel
11. Other → Intelligent classification based on merchant name

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

[Specify your license here]

## 👤 Author

[Your name/contact information]

---

**Note**: This project is designed for personal financial tracking. Ensure compliance with your bank's terms of service and local regulations regarding financial data processing.
