// Supabase Edge Function — triggered by a database webhook whenever
// a row is inserted into shopping_items. Sends a push notification
// to all subscribed devices via OneSignal.

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')!
const ONESIGNAL_API_KEY = Deno.env.get('ONESIGNAL_API_KEY')!

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const record = payload.record

    // Only notify on INSERT (new item added)
    if (payload.type !== 'INSERT') {
      return new Response('ignored', { status: 200 })
    }

    const itemName = record.name
    const emoji = record.emoji || '🛒'
    const quantity = record.quantity ? ` (${record.quantity})` : ''

    const notification = {
      app_id: ONESIGNAL_APP_ID,
      included_segments: ['Total Subscriptions'],
      headings: { en: 'Shopping List' },
      contents: { en: `${emoji} ${itemName}${quantity} added to the list` },
      url: Deno.env.get('APP_URL') || '',
    }

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify(notification),
    })

    const result = await response.json()
    return new Response(JSON.stringify(result), { status: 200 })
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
})
