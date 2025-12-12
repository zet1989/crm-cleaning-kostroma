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

  private async makeRequest(method: string, params: Record<string, any> = {}): Promise<any> {
    const requestBody = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params: {
        ...params,
        access_token: this.accessToken,
      },
    });

    return new Promise((resolve, reject) => {
      const req = https.request(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'Content-Length': Buffer.byteLength(requestBody),
          'Accept': 'application/json',
        },
        timeout: 30000,
      }, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            
            if (json.error) {
              reject(new Error(`Novofon API error [${json.error.code}]: ${json.error.message}${json.error.data?.mnemonic ? ` (${json.error.data.mnemonic})` : ''}`));
            } else {
              resolve(json.result);
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

      req.write(requestBody);
      req.end();
    });
  }

  /**
   * Получение отчета по звонкам
   * get.calls_report из Data API
   */
  async getCalls(
    dateFrom: string, // YYYY-MM-DD HH:MM:SS
    dateTill: string  // YYYY-MM-DD HH:MM:SS
  ): Promise<any> {
    return this.makeRequest('get.calls_report', {
      date_from: dateFrom,
      date_till: dateTill,
    });
  }

  /**
   * Получение недавних входящих звонков на указанный внутренний номер
   */
  async getRecentIncomingCalls(internal: string, minutesBack: number = 5): Promise<NovofonCall[]> {
    const now = new Date();
    const from = new Date(now.getTime() - minutesBack * 60 * 1000);
    
    // Формат: YYYY-MM-DD HH:MM:SS
    const formatDate = (date: Date): string => {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    };

    const result = await this.getCalls(formatDate(from), formatDate(now));
    
    // Преобразуем формат Novofon в наш
    const calls = (result.data || []).map((item: any) => ({
      id: item.communication_id?.toString() || item.id?.toString(),
      start: item.start_time || item.communication_date_create,
      finish: item.finish_time || item.communication_date_modify,
      direction: item.direction,
      status: item.is_lost ? 'missed' : 'answered',
      from: item.contact_phone_number,
      to: item.virtual_phone_number,
      internal: item.employee_phone_number || '',
      record: item.call_records?.[0] || null,
      duration: item.total_duration || 0,
      wait_duration: item.wait_duration || 0,
      talk_duration: item.talk_duration || 0,
    }));

    // Фильтруем только входящие
    return calls.filter((call: NovofonCall) => call.direction === 'in');
  }

  /**
   * Скачивание записи разговора
   */
  async downloadRecord(recordUrl: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      https.get(recordUrl, (res) => {
        const chunks: Buffer[] = [];
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        res.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
      }).on('error', reject);
    });
  }
}
