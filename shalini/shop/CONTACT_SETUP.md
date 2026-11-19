# Contact form delivery

The Contact Us form validates its fields and opens a prefilled email draft addressed to `itsshalini007@gmail.com`. It does not send or store submissions. Customers must review the draft and send it in their email app. If no email app is configured, they can email the address directly or use the WhatsApp link.

Automatic delivery or website-side storage is not configured. To add it, deploy a trusted HTTPS backend (for example, a Firebase Cloud Function) that validates and limits submissions, sends email through a provider using server-side credentials, and returns a real success or error response. Keep provider credentials out of browser code, add abuse controls such as App Check and rate limiting, and update the form to report success only after the backend confirms delivery or storage.

The current form deliberately does not claim that a message was sent. No backend endpoint, email provider, delivery promise, or message-retention policy has been configured.
