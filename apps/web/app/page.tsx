import { APP_NAME } from '@/constants'

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {APP_NAME}
      </h1>
      <p className="text-sm text-muted-foreground">Scaffold ready</p>
    </main>
  )
}
