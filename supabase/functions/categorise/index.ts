import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CATEGORIES = [
  'Fruit & Veg',
  'Meat & Fish',
  'Dairy',
  'Bakery',
  'Frozen',
  'Drinks',
  'Tins & Dry Goods',
  'Toiletries & Health',
  'Household',
  'Other',
]

Deno.serve(async (req) => {
  try {
    const payload = await req.json()

    if (payload.type !== 'INSERT') {
      return new Response('ignored', { status: 200 })
    }

    const { id: itemId, name: itemName } = payload.record

    // Ask Claude Haiku to categorise the item
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 20,
        messages: [
          {
            role: 'user',
            content: `Categorise this grocery item into exactly one of these categories: ${CATEGORIES.join(', ')}. Reply with only the category name, nothing else. Item: "${itemName}"`,
          },
        ],
      }),
    })

    const result = await response.json()
    const raw = result.content?.[0]?.text?.trim() ?? ''
    const category = CATEGORIES.includes(raw) ? raw : 'Other'

    // Write the category back to the item row
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    await supabase.from('shopping_items').update({ category }).eq('id', itemId)

    console.log(`Categorised "${itemName}" → "${category}"`)
    return new Response(JSON.stringify({ category }), { status: 200 })
  } catch (err) {
    console.error('Error:', String(err))
    return new Response(String(err), { status: 500 })
  }
})
