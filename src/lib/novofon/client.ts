import crypto from 'crypto';
import https from 'https';

export interface NovofonCall {
  id: string;
  start: string;
  finish: string;
  direction: 'in' | 'out';
  status: string;
  from: string;
  to: string;
  internal: string;
  record?: string;
  duration: number;
  wait_duration: number;
  talk_duration: number;
}

export interface NovofonCallsResponse {
  calls: NovofonCall[];
  total: number;
}

export class NovofonClient {
  private accessToken: string;
  private baseUrl = 'https://dataapi-jsonrpc.novofon.ru/v2.0';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Генерация подписи для API запроса
   */
  private generateSignature(params: Record<string, string>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    const signString = `${sortedParams}${this.secret}`;
    return crypto.createHash('md5').update(signString).digest('hex');
  }

  /**
   * Получение истории звонков за период
   * @param from Дата начала (YYYY-MM-DD)
   * @param to Дата окончания (YYYY-MM-DD)
   * @param internal Внутренний номер (опционально)
   */
  async getCalls(
    from: string,
    to: string,
    internal?: string
  ): Promise<NovofonCallsResponse> {
    const params: Record<string, string> = {
      appid: this.appId,
      from,
      to,
    };

    if (internal) {
      params.internal = internal;
    }

    const sign = this.generateSignature(params);
    const queryParams = new URLSearchParams({ ...params, sign });
    const url = `${this.baseUrl}/statistic/call_history/?${queryParams}`;

    return new Promise((resolve, reject) => {
      const req = https.get(url, {
        timeout: 30000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CRM-Client/1.0',
        },
      }, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`Novofon API error: ${res.statusCode} - ${data}`));
            } else {
              resolve(JSON.parse(data));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  /**
   * Получение новых входящих звонков за последние N минут
   * @param minutes Количество минут назад (по умолчанию 5)
   * @param internal Внутренний номер (опционально)
   */
  async getRecentIncomingCalls(
    minutes: number = 5,
    internal?: string
  ): Promise<NovofonCall[]> {
    const now = new Date();
    const past = new Date(now.getTime() - minutes * 60 * 1000);

    const from = past.toISOString().split('T')[0];
    const to = now.toISOString().split('T')[0];

    const response = await this.getCalls(from, to, internal);

    // Фильтруем только входящие звонки за нужный период
    const cutoffTime = past.getTime();
    return response.calls.filter(call => {
      const callTime = new Date(call.start).getTime();
      return call.direction === 'in' && callTime >= cutoffTime;
    });
  }

  /**
   * Скачивание записи звонка
   * @param recordUrl URL записи звонка
   */
  async downloadRecord(recordUrl: string): Promise<Buffer> {
    const response = await axios.get(recordUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    
    return Buffer.from(response.data);
  }
}

/**
 * Создание клиента Novofon из переменных окружения
 */
export function createNovofonClient(): NovofonClient {
  const appId = process.env.NOVOFON_APP_ID;
  const secret = process.env.NOVOFON_SECRET;

  if (!appId || !secret) {
    throw new Error('NOVOFON_APP_ID and NOVOFON_SECRET must be set in environment variables');
  }

  return new NovofonClient(appId, secret);
}
