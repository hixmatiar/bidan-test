import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sistem Digitalisasi Praktik Mandiri Bidan</CardTitle>
          <CardDescription>Praktik Mandiri Bdn. Ria Indrasti J., S.Keb</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Aplikasi pencatatan dan pengelolaan data praktik bidan secara digital.
          </p>
          <div className="space-y-2">
            <Label htmlFor="placeholder-input">Contoh Input</Label>
            <Input id="placeholder-input" placeholder="Ketik di sini..." />
          </div>
          <div className="flex items-center gap-2">
            <Badge>Starter</Badge>
            <Button>Mulai</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default App
