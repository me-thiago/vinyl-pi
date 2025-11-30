import { Link } from "react-router-dom"
import { Music, Radio, Activity, Database, Disc3, LayoutDashboard, Settings, Calendar, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/theme-toggle"
import { Player } from "@/components/Player/Player"

function App() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground">
              <Disc3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Vinyl-OS</h1>
              <p className="text-xs text-muted-foreground">v1.0.0 - MVP</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/dashboard">
              <Button variant="outline" size="sm" className="gap-2">
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
            </Link>
            <Link to="/sessions">
              <Button variant="outline" size="sm" className="gap-2">
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline">Sessões</span>
              </Button>
            </Link>
            <Link to="/diagnostics">
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Diagnóstico</span>
              </Button>
            </Link>
            <Link to="/settings">
              <Button variant="outline" size="sm" className="gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">Configurações</span>
              </Button>
            </Link>
            <Badge variant="secondary">Development</Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <Badge className="mb-4" variant="outline">
            Setup Completo ✅
          </Badge>
          <h2 className="text-4xl font-bold mb-4">
            Sistema de Monitoramento de Vinis
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Captura, processa e transmite áudio de toca-discos com detecção
            inteligente de eventos e monitoramento em tempo real.
          </p>
        </div>

        <Separator className="my-8" />

        {/* Player Section */}
        <div className="mb-12">
          <Player streamUrl={import.meta.env.VITE_STREAM_URL || "http://localhost:8000/stream"} />
        </div>

        <Separator className="my-8" />

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card>
            <CardHeader>
              <Music className="w-8 h-8 mb-2 text-primary" />
              <CardTitle className="text-lg">Captura ALSA</CardTitle>
              <CardDescription>
                Captura de áudio direto do toca-discos via ALSA
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Radio className="w-8 h-8 mb-2 text-primary" />
              <CardTitle className="text-lg">Streaming Icecast</CardTitle>
              <CardDescription>
                Transmissão ao vivo via Icecast2 com FFmpeg
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Activity className="w-8 h-8 mb-2 text-primary" />
              <CardTitle className="text-lg">Detecção de Eventos</CardTitle>
              <CardDescription>
                Silêncio, clipping, troca de faixa e sessões
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Database className="w-8 h-8 mb-2 text-primary" />
              <CardTitle className="text-lg">Histórico</CardTitle>
              <CardDescription>
                Registro completo de eventos e sessões
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Stack Info */}
        <Card>
          <CardHeader>
            <CardTitle>Stack Tecnológico</CardTitle>
            <CardDescription>
              Tecnologias utilizadas neste projeto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="secondary">Backend</Badge>
                </h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Node.js 20 LTS + Express 4.x</li>
                  <li>• TypeScript + Prisma ORM</li>
                  <li>• Socket.io + Winston Logger</li>
                  <li>• SQLite3 Database</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="secondary">Frontend</Badge>
                </h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• React 19 + Vite 7</li>
                  <li>• TypeScript + TailwindCSS v4</li>
                  <li>• shadcn/ui + tweakcn theme</li>
                  <li>• Recharts + React Router</li>
                </ul>
              </div>
            </div>

            <Separator className="my-6" />

            <div className="flex flex-wrap gap-2">
              <Badge>Express</Badge>
              <Badge>React</Badge>
              <Badge>Vite</Badge>
              <Badge>Prisma</Badge>
              <Badge>Socket.io</Badge>
              <Badge>Tailwind</Badge>
              <Badge>shadcn/ui</Badge>
              <Badge>TypeScript</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Backend Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-sm text-muted-foreground">
                  Pronto para iniciar
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Frontend Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-sm text-muted-foreground">
                  Rodando em desenvolvimento
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Build Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-sm text-muted-foreground">
                  195.25 kB compiled
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <h3 className="text-xl font-semibold mb-2">
                Próximos Passos
              </h3>
              <p className="text-muted-foreground mb-4">
                Story v1-01 concluída! Pronto para implementar Prisma schemas
              </p>
              <div className="flex gap-3 justify-center">
                <Button>Ver Documentação</Button>
                <Button variant="outline">
                  Iniciar Backend
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>
            Vinyl-OS © 2025 • Epic V1 - Foundation Core (MVP) •{" "}
            <Badge variant="outline" className="ml-2">
              Story v1-01 ✅
            </Badge>
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
