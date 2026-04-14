const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')!
const ONESIGNAL_API_KEY = Deno.env.get('ONESIGNAL_API_KEY')!

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    console.log('Webhook payload type:', payload.type)
    console.log('Record:', JSON.stringify(payload.record))

    if (payload.type !== 'INSERT') {
      console.log('Ignoring non-INSERT event')
      return new Response('ignored', { status: 200 })
    }

    const record = payload.record
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

    console.log('Sending notification:', JSON.stringify(notification))

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify(notification),
    })

    const result = await response.json()
    console.log('OneSignal response:', JSON.stringify(result))
    return new Response(JSON.stringify(result), { status: 200 })
  } catch (err) {
    console.error('Error:', String(err))
    return new Response(String(err), { status: 500 })
  }
})
