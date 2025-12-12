import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold">🧹 CRM Клининговой Компании</h1>
        <p className="text-muted-foreground text-lg max-w-md">
          Система управления заказами, исполнителями и аналитикой для клининговой компании
        </p>
        <div className="flex gap-4 justify-center">
          <Link 
            href="/login"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Войти в систему
          </Link>
        </div>
      </div>
    </div>
  )
}
