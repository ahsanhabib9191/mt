# 🌟 Platform Features

## 🧠 Optimization Intelligence ("The Brain")
The core of the system is the **Optimization Engine**, designed to act as an autonomous media buyer.
*   **Real-time Analysis**: Scans Ad Sets for CPA, ROAS, and Spend metrics.
*   **Rule-Based Decisioning**:
    *   **Pause**: Stops ads wasting budget (Low ROAS, High CPA).
    *   **Scale**: Increases budget for winners (High ROAS).
    *   **Revive**: Identifies potential comebacks.
*   **Confidence Intervals**: Uses Wilson Score intervals to avoid premature decisions on low data.
*   **Activity Logging**: Every decision is logged and displayed in the Dashboard.

## 🚀 Resilient Launch System
Creating campaigns is complex. Our system makes it robust.
*   **Asynchronous Queue**: When you click "Launch", the job is queued in Redis. You get instant UI feedback.
*   **Retry Mechanism**: If Meta's API blips, the Worker retries with exponential backoff.
*   **State Management**: Tracks "Uploading", "Processing", "Completed", "Failed" states granularly.
*   **Creative Processing**: Handles image/video verification before submission.

## 🛡️ "Flight Simulator" Mode (Mock Mode)
Develop safely without spending a cent.
*   **Mock Graph API**: Intercepts Meta API calls and returns realistic mock responses.
*   **Simulated Performance**: Generates fake "Clicks", "Spend", and "Conversions" that look real.
*   **Scenario Testing**: Can inject "Bad Performance" scenarios to test the Optimizer's reaction.

## 📊 Giant Tech Dashboard
A premium React interface.
*   **Visual Analytics**: Charts showing ROAS trends over time (Recharts).
*   **Live Activity Feed**: Streaming logs of system actions.
*   **Campaign Manager**: View and manage active campaigns.
*   **Connect Flow**: Seamless OAuth integration with Meta.

## 🏗️ Infrastructure
*   **Dockerized**: Full container orchestration.
*   **Self-Healing**: Scripts detect and fix "Ghost Connections" or invalid states.
*   **Secure**: AES-256 encryption for all stored Access Tokens.
*   **Scalable**: Backend and Workers can be scaled independently.
