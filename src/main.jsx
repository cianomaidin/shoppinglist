import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Initialise OneSignal for push notifications.
// This runs once when the app loads and asks the user for
// permission to send notifications.
window.OneSignalDeferred = window.OneSignalDeferred || []
window.OneSignalDeferred.push(async function (OneSignal) {
  await OneSignal.init({
    appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
    serviceWorkerParam: { scope: '/' },
    promptOptions: {
      slidedown: {
        prompts: [
          {
            type: 'push',
            autoPrompt: true,
            text: {
              actionMessage: 'Get notified when items are added to the shopping list',
              acceptButton: 'Allow',
              cancelButton: 'Not now',
            },
            delay: {
              pageViews: 1,
              timeDelay: 5,
            },
          },
        ],
      },
    },
  })
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
