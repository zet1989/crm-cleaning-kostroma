import crypto from 'crypto'

const NOVOFON_APP_ID = 'appid_5038129'
const NOVOFON_SECRET = 'y7t9dneo16ryifw5okgcmlo9cyjqtur9ljsnworj'

const callIds = [
  '290043698',
  '290041554', 
  '290132161'
]

async function getRecordingUrl(callId: string) {
  const method = '/v1/pbx/record/request/'
  const params: Record<string, string> = {
    call_id: callId
  }
  
  // Сортируем параметры по алфавиту
  const sortedKeys = Object.keys(params).sort()
  const paramsStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&')
  const md5Hash = crypto.createHash('md5').update(paramsStr).digest('hex')
  
  // Формируем строку для подписи: method + paramsStr + md5(paramsStr)
  const signatureStr = `${method}${paramsStr}${md5Hash}`
  const signature = crypto.createHmac('sha1', NOVOFON_SECRET).update(signatureStr).digest('base64')
  
  console.log(`\n=== Call ID: ${callId} ===`)
  console.log(`URL: https://api.novofon.com${method}?${paramsStr}`)
  console.log(`Authorization: ${NOVOFON_APP_ID}:${signature}`)
  console.log(`Debug:`)
  console.log(`  paramsStr: ${paramsStr}`)
  console.log(`  md5Hash: ${md5Hash}`)
  console.log(`  signatureStr: ${signatureStr}`)
  
  const response = await fetch(
    `https://api.novofon.com${method}?${paramsStr}`,
    {
      headers: {
        'Authorization': `${NOVOFON_APP_ID}:${signature}`
      }
    }
  )
  
  const data = await response.json()
  console.log(`Response (${response.status}):`, JSON.stringify(data, null, 2))
  
  return data
}

async function main() {
  for (const callId of callIds) {
    try {
      await getRecordingUrl(callId)
    } catch (err) {
      console.error(`Error for ${callId}:`, err)
    }
  }
}

main()
