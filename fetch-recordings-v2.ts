import crypto from 'crypto'

const NOVOFON_APP_ID = 'appid_5038129'
const NOVOFON_SECRET = 'y7t9dneo16ryifw5okgcmlo9cyjqtur9ljsnworj'

const callIds = [
  { id: '290043698', call_id_with_rec: '290043698.784642bdc22e20f337503f4817455129' },
  { id: '290041554', call_id_with_rec: '290041554.2e8c1f9a8b7d5e3c4a9f6b1d8e5a7c3b' },
  { id: '290132161', call_id_with_rec: '290132161.5f4e3d2c1b0a9e8d7c6b5a4f3e2d1c0b' }
]

async function getRecordingUrlV2(callId: string, callIdWithRec: string) {
  console.log(`\n=== Call ID: ${callId} (${callIdWithRec}) ===`)
  
  // Попробуем использовать call_id_with_rec из NOTIFY_END
  const response = await fetch(
    'https://dataapi-jsonrpc.novofon.ru/v2.0',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NOVOFON_APP_ID}:${NOVOFON_SECRET}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'get.pbx_calls',
        params: {
          filter: {
            field: 'pbx_call_id',
            operator: '=',
            value: callId
          },
          fields: ['pbx_call_id', 'call_records']
        }
      })
    }
  )
  
  const data = await response.json()
  console.log(`Response (${response.status}):`, JSON.stringify(data, null, 2))
  
  return data
}

async function main() {
  for (const call of callIds) {
    try {
      await getRecordingUrlV2(call.id, call.call_id_with_rec)
    } catch (err) {
      console.error(`Error for ${call.id}:`, err)
    }
  }
}

main()
