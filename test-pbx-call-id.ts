import crypto from 'crypto'

const NOVOFON_APP_ID = 'appid_5038129'
const NOVOFON_SECRET = '0vdeoz0pi5e99pzv716g6to3rntr9zbfaka6k0uu'

// Используем pbx_call_id вместо call_id
async function getRecording(pbxCallId: string) {
  const method = '/v1/pbx/record/request/'
  const params: Record<string, string> = {
    pbx_call_id: pbxCallId
  }
  
  const sortedKeys = Object.keys(params).sort()
  const paramsStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&')
  const md5Hash = crypto.createHash('md5').update(paramsStr).digest('hex')
  const signatureStr = `${method}${paramsStr}${md5Hash}`
  const signature = crypto.createHmac('sha1', NOVOFON_SECRET).update(signatureStr).digest('base64')
  
  console.log(`\n=== PBX Call ID: ${pbxCallId} ===`)
  console.log(`URL: https://api.novofon.com${method}?${paramsStr}`)
  
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
}

getRecording('303702443')
