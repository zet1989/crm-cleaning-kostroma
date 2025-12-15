import { Pool, PoolClient } from 'pg'

// Создаём пул подключений к базе данных
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'crm',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})

// Проверяем подключение при старте
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err)
})

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[]
  rowCount: number
}

// Выполнить SQL запрос
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const client = await pool.connect()
  try {
    const result = await client.query(text, params)
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount || 0,
    }
  } finally {
    client.release()
  }
}

// Получить одну запись
export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const result = await query<T>(text, params)
  return result.rows[0] || null
}

// Транзакция
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

// Получить пул для прямого использования
export function getPool(): Pool {
  return pool
}

export default pool
